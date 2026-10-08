<?php
/**
 * SAMS first-administrator bootstrap.
 *
 * Run from the project root after the database/schema has been installed:
 *   php scripts/create_admin.php
 *
 * This is intentionally CLI-only and creates the first administrator for one
 * school. It never accepts a password as a command-line argument.
 */
declare(strict_types=1);

require_once __DIR__ . '/../backend/src/bootstrap.php';

use SAMS\Helpers\Audit;
use SAMS\Helpers\Database;
use SAMS\Helpers\Security;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Services\UserService;

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script must be executed from the command line.\n");
    exit(1);
}

set_exception_handler(static function (Throwable $e): void {
    fwrite(STDERR, "[FAIL] Bootstrap failed: {$e->getMessage()}" . PHP_EOL);
    exit(1);
});

function usage(): void
{
    fwrite(STDOUT, <<<'TEXT'
SAMS first-administrator bootstrap

Usage:
  php scripts/create_admin.php [options]

Options:
  --school-id=ID       Use an existing active school.
  --school-code=CODE  School code when creating a new school.
  --school-name=NAME  School name when creating a new school.
  --username=NAME     Administrator username.
  --full-name=NAME    Administrator full name.
  --password-stdin    Read the password from STDIN (automation/secret manager use).
  --help               Show this help.

Notes:
  - The script is CLI-only.
  - It refuses to create another administrator when the selected school
    already has an administrator account.
  - Passwords are never supplied as command-line arguments.
TEXT);
}

function parseOptions(array $argv): array
{
    $options = [
        'school_id' => null,
        'school_code' => null,
        'school_name' => null,
        'username' => null,
        'full_name' => null,
        'password_stdin' => false,
    ];

    for ($i = 1, $count = count($argv); $i < $count; $i++) {
        $arg = $argv[$i];

        if ($arg === '--help') {
            usage();
            exit(0);
        }

        if ($arg === '--password-stdin') {
            $options['password_stdin'] = true;
            continue;
        }

        if (preg_match('/^--school-id=(.+)$/', $arg, $match)) {
            $options['school_id'] = $match[1];
            continue;
        }

        if (preg_match('/^--school-code=(.+)$/', $arg, $match)) {
            $options['school_code'] = $match[1];
            continue;
        }

        if (preg_match('/^--school-name=(.+)$/', $arg, $match)) {
            $options['school_name'] = $match[1];
            continue;
        }

        if (preg_match('/^--username=(.+)$/', $arg, $match)) {
            $options['username'] = $match[1];
            continue;
        }

        if (preg_match('/^--full-name=(.+)$/', $arg, $match)) {
            $options['full_name'] = $match[1];
            continue;
        }

        throw new InvalidArgumentException("Unknown option: {$arg}");
    }

    if ($options['school_id'] !== null) {
        if (!ctype_digit((string)$options['school_id']) || (int)$options['school_id'] < 1) {
            throw new InvalidArgumentException('school-id must be a positive integer.');
        }
        $options['school_id'] = (int)$options['school_id'];
    }

    return $options;
}

function prompt(string $label, ?string $default = null): string
{
    $suffix = $default !== null ? " [{$default}]" : '';
    fwrite(STDOUT, $label . $suffix . ': ');
    $value = fgets(STDIN);
    if ($value === false) {
        throw new RuntimeException('Unable to read terminal input.');
    }

    $value = rtrim($value, "\r\n");
    return $value === '' && $default !== null ? $default : $value;
}

function isInteractiveStdin(): bool
{
    if (function_exists('stream_isatty')) {
        return @stream_isatty(STDIN);
    }

    if (function_exists('posix_isatty')) {
        return @posix_isatty(STDIN);
    }

    return false;
}

function readPassword(string $label): string
{
    if (isInteractiveStdin()) {
        if (PHP_OS_FAMILY === 'Windows') {
            $script = <<<'PS'
$p = '';
[Console]::Write('PASSWORD_PROMPT');
while (($key = [Console]::ReadKey($true)).Key -ne 'Enter') {
    if ($key.Key -eq 'Backspace') {
        if ($p.Length -gt 0) {
            $p = $p.Substring(0, $p.Length - 1);
        }
        continue;
    }
    if ($key.KeyChar -ne [char]0) {
        $p += $key.KeyChar;
    }
}
[Console]::WriteLine();
[Console]::Write($p);
PS;
            $script = str_replace('PASSWORD_PROMPT', addcslashes($label, "\\'"), $script);
            $command = 'powershell.exe -NoProfile -Command ' . escapeshellarg($script);
            $password = shell_exec($command);
            if ($password === null) {
                throw new RuntimeException('Unable to read the password securely.');
            }
            return rtrim($password, "\r\n");
        }

        $termState = shell_exec('stty -g 2>/dev/null');
        if ($termState === null || trim($termState) === '') {
            throw new RuntimeException('Unable to protect terminal input.');
        }

        fwrite(STDOUT, $label . ': ');
        shell_exec('stty -echo');
        try {
            $password = fgets(STDIN);
        } finally {
            shell_exec('stty ' . trim($termState));
            fwrite(STDOUT, PHP_EOL);
        }

        if ($password === false) {
            throw new RuntimeException('Unable to read terminal input.');
        }

        return rtrim($password, "\r\n");
    }

    fwrite(STDERR, "Warning: STDIN is not an interactive terminal; input will be visible. Prefer --password-stdin for automation.\n");
    return prompt($label);
}

function validateSchoolCode(string $code): string
{
    $code = trim($code);
    if ($code === '' || strlen($code) > 20 || !preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]*$/', $code)) {
        throw new InvalidArgumentException(
            'School code must be 1-20 characters and contain only letters, numbers, "_" or "-".'
        );
    }

    return $code;
}

function validateSchoolName(string $name): string
{
    $name = trim((string)(preg_replace('/\\s+/u', ' ', $name) ?? ''));
    if ($name === '' || mb_strlen($name) > 150) {
        throw new InvalidArgumentException('Invalid school name.');
    }

    return $name;
}

function readSchoolId(PDO $pdo, ?int $requestedSchoolId): ?int
{
    $stmt = $pdo->query(
        "SELECT id, code, name
         FROM schools
         WHERE status = 'active'
         ORDER BY id"
    );
    $schools = $stmt->fetchAll();

    if ($requestedSchoolId !== null) {
        $check = $pdo->prepare(
            "SELECT id, code, name
             FROM schools
             WHERE id = ? AND status = 'active'
             LIMIT 1"
        );
        $check->execute([$requestedSchoolId]);
        $school = $check->fetch();

        if ($school === false) {
            throw new InvalidArgumentException('The selected school does not exist or is not active.');
        }

        fwrite(STDOUT, "Using active school #{$school['id']}: {$school['name']} ({$school['code']})\n");
        return (int)$school['id'];
    }

    if (count($schools) === 1) {
        $school = $schools[0];
        fwrite(STDOUT, "Using active school #{$school['id']}: {$school['name']} ({$school['code']})\n");
        return (int)$school['id'];
    }

    if (count($schools) > 1) {
        fwrite(STDOUT, "Multiple active schools found. Choose the school for the first administrator:\n");
        foreach ($schools as $school) {
            fwrite(STDOUT, "  {$school['id']} — {$school['name']} ({$school['code']})\n");
        }

        $selected = prompt('School ID');
        if (!ctype_digit($selected) || (int)$selected < 1) {
            throw new InvalidArgumentException('School ID must be a positive integer.');
        }

        return readSchoolId($pdo, (int)$selected);
    }

    return null;
}

$options = parseOptions($argv);
$pdo = Database::connection();
$schoolId = readSchoolId($pdo, $options['school_id']);

if ($schoolId !== null) {
    $existingAdminCheck = $pdo->prepare(
        "SELECT id
         FROM users
         WHERE school_id = ? AND role = 'admin'
         LIMIT 1"
    );
    $existingAdminCheck->execute([$schoolId]);

    if ($existingAdminCheck->fetchColumn() !== false) {
        throw new RuntimeException(
            'Bootstrap already completed for this school. Use the administrator account lifecycle tools for further changes.'
        );
    }
}

if ($schoolId === null) {
    fwrite(STDOUT, "No active school exists. A new school will be created.\n");
    $schoolCode = $options['school_code'] ?? prompt('School code');
    $schoolName = $options['school_name'] ?? prompt('School name');
    $schoolCode = validateSchoolCode($schoolCode);
    $schoolName = validateSchoolName($schoolName);
} else {
    if ($options['school_code'] !== null || $options['school_name'] !== null) {
        throw new InvalidArgumentException('--school-code and --school-name are only valid when creating a new school.');
    }
}

$validator = new UserService();
$username = $validator->validateUsername(
    $options['username'] ?? prompt('Administrator username')
);
$fullName = $validator->validateFullName(
    $options['full_name'] ?? prompt('Administrator full name')
);

if ($options['password_stdin']) {
    $password = fgets(STDIN);
    if ($password === false) {
        throw new RuntimeException('Unable to read password from STDIN.');
    }
    $password = rtrim($password, "\r\n");
} else {
    $password = readPassword('Administrator password');
    $confirmation = readPassword('Confirm password');

    if ($password !== $confirmation) {
        throw new InvalidArgumentException('Passwords do not match.');
    }
}

$password = $validator->validatePassword($password);

$lockName = 'sams.bootstrap.first-admin';
$lockAcquired = false;
$transactionStarted = false;

try {
    $lockStmt = $pdo->prepare('SELECT GET_LOCK(?, 10)');
    $lockStmt->execute([$lockName]);
    $lockAcquired = (int)$lockStmt->fetchColumn() === 1;

    if (!$lockAcquired) {
        throw new RuntimeException('Could not obtain the bootstrap lock. Another bootstrap may be running.');
    }

    $pdo->beginTransaction();
    $transactionStarted = true;

    if ($schoolId === null) {
        $existingCode = $pdo->prepare('SELECT id FROM schools WHERE code = ? LIMIT 1');
        $existingCode->execute([$schoolCode]);
        if ($existingCode->fetchColumn() !== false) {
            throw new InvalidArgumentException('That school code already exists. Choose a different code.');
        }

        $schoolStmt = $pdo->prepare(
            "INSERT INTO schools (code, name, status)
             VALUES (?, ?, 'active')"
        );
        $schoolStmt->execute([$schoolCode, $schoolName]);
        $schoolId = (int)$pdo->lastInsertId();
    } else {
        $schoolCheck = $pdo->prepare(
            "SELECT id, code, name
             FROM schools
             WHERE id = ? AND status = 'active'
             LIMIT 1
             FOR UPDATE"
        );
        $schoolCheck->execute([$schoolId]);
        if ($schoolCheck->fetch() === false) {
            throw new RuntimeException('The selected school is no longer active.');
        }
    }

    $existingAdmin = $pdo->prepare(
        "SELECT id, username, account_status, is_active
         FROM users
         WHERE school_id = ? AND role = 'admin'
         LIMIT 1
         FOR UPDATE"
    );
    $existingAdmin->execute([$schoolId]);
    $adminRow = $existingAdmin->fetch();

    if ($adminRow !== false) {
        throw new RuntimeException(
            "Bootstrap already completed for this school (administrator #{$adminRow['id']}). " .
            'Use the administrator account lifecycle tools for further changes.'
        );
    }

    $insert = $pdo->prepare(
        "INSERT INTO users
            (school_id, username, full_name, password_hash, role, account_status, is_active)
         VALUES (?, ?, ?, ?, 'admin', 'active', 1)"
    );
    $insert->execute([
        $schoolId,
        $username,
        $fullName,
        Security::hashPassword($password),
    ]);

    $adminId = (int)$pdo->lastInsertId();

    $audit = new AuditLogRepository();
    $audit->record(
        null,
        Audit::actionName('system.bootstrap_admin'),
        'user',
        $adminId,
        [
            'username' => $username,
            'bootstrap' => true,
        ],
        $schoolId
    );

    $pdo->commit();
    $transactionStarted = false;

    fwrite(STDOUT, PHP_EOL . "[PASS] First administrator created successfully." . PHP_EOL);
    fwrite(STDOUT, "School ID: {$schoolId}" . PHP_EOL);
    fwrite(STDOUT, "Username: {$username}" . PHP_EOL);
    fwrite(STDOUT, "Administrator ID: {$adminId}" . PHP_EOL);
    fwrite(STDOUT, "Log in to SAMS and create/manage the remaining accounts from the administrator workspace." . PHP_EOL);
} catch (Throwable $e) {
    if ($transactionStarted && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    fwrite(STDERR, "[FAIL] Bootstrap failed: {$e->getMessage()}" . PHP_EOL);
    exit(1);
} finally {
    if ($lockAcquired) {
        try {
            $release = $pdo->prepare('SELECT RELEASE_LOCK(?)');
            $release->execute([$lockName]);
        } catch (Throwable) {
            // Do not mask the original result with a lock-release warning.
        }
    }
}

