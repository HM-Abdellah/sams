<?php

declare(strict_types=1);

require_once __DIR__ . '/../backend/vendor/autoload.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Database;
use SAMS\Helpers\Security;
use SAMS\Http\Request;
use SAMS\Services\AuthService;
use SAMS\Services\SchoolWorkbookImportService;
use SAMS\Services\StudentImportService;

function p7_expect(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function p7_expect_exception(callable $callback, string $message): Throwable
{
    try {
        $callback();
    } catch (Throwable $e) {
        return $e;
    }

    throw new RuntimeException($message);
}

function p7_execute_schema(PDO $pdo, string $sql): void
{
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    foreach (preg_split('/;\s*(?:\R|$)/', $sql, -1, PREG_SPLIT_NO_EMPTY) as $statement) {
        if (trim($statement) !== '') {
            $pdo->exec($statement);
        }
    }
}

// RED contract: these new hardening boundaries do not exist before Phase 7.
p7_expect(
    method_exists(Security::class, 'responseHeaders'),
    'Missing Security::responseHeaders hardening boundary.'
);
p7_expect(
    defined(Request::class . '::MAX_JSON_BODY_SIZE'),
    'Missing bounded JSON request-body limit.'
);

$headers = Security::responseHeaders(false);
p7_expect(
    ($headers['X-Content-Type-Options'] ?? null) === 'nosniff',
    'Missing nosniff header.'
);
p7_expect(
    ($headers['Content-Security-Policy'] ?? null) === "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'Missing restrictive CSP header.'
);
p7_expect(
    ($headers['Permissions-Policy'] ?? null) === 'camera=(), geolocation=(), microphone=()',
    'Missing Permissions-Policy header.'
);
p7_expect(
    !isset($headers['Strict-Transport-Security']),
    'HSTS must not be emitted for plain HTTP.'
);

$httpsHeaders = Security::responseHeaders(true);
p7_expect(
    ($httpsHeaders['Strict-Transport-Security'] ?? null) === 'max-age=31536000; includeSubDomains',
    'HTTPS responses must emit HSTS.'
);

$oversizedBody = json_encode([
    'padding' => str_repeat('x', Request::MAX_JSON_BODY_SIZE),
], JSON_THROW_ON_ERROR);
p7_expect(
    strlen($oversizedBody) > Request::MAX_JSON_BODY_SIZE,
    'RED fixture did not exceed the configured JSON body limit.'
);

$request = new Request('POST', '/security-test', [], [], $oversizedBody);
$payloadError = p7_expect_exception(
    static fn() => $request->jsonBody(),
    'Oversized JSON payload was accepted.'
);
p7_expect(
    str_contains(strtolower($payloadError->getMessage()), 'too large'),
    'Oversized JSON rejection does not identify the size violation.'
);
p7_expect(
    method_exists($payloadError, 'httpStatus') && $payloadError->httpStatus() === 413,
    'Oversized JSON rejection must use HTTP status 413.'
);

$host = getenv('SAMS_TEST_DB_HOST') ?: '';
$port = (int)(getenv('SAMS_TEST_DB_PORT') ?: 3306);
$db = getenv('SAMS_TEST_DB_NAME') ?: '';
$user = getenv('SAMS_TEST_DB_USER') ?: '';
$pass = getenv('SAMS_TEST_DB_PASS') ?: '';

p7_expect($host !== '' && $db !== '' && $user !== '', 'Missing SAMS_TEST_DB_* environment variables.');

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $db),
    $user,
    $pass,
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]
);

$schema = file_get_contents(__DIR__ . '/../database/schema.sql');
p7_expect($schema !== false, 'Unable to read schema.');
p7_execute_schema($pdo, $schema);

$pdo->exec("INSERT INTO users
    (username, employee_id, full_name, password_hash, role, is_active, session_version)
VALUES ('phase7-admin', 'P7A', 'Phase 7 Admin', 'synthetic-hash', 'admin', 1, 1),
       ('phase7-inactive', 'P7I', 'Phase 7 Inactive', 'synthetic-hash', 'teacher', 0, 1)");

p7_expect(
    (int)$pdo->getAttribute(PDO::ATTR_EMULATE_PREPARES) === 0,
    'PDO emulated prepares must remain disabled.'
);
p7_expect(
    (int)Database::connection()->getAttribute(PDO::ATTR_EMULATE_PREPARES) === 0,
    'SAMS Database connection must keep emulated prepares disabled.'
);
p7_expect(SchoolWorkbookImportService::MAX_FILE_SIZE === 20_000_000, 'Workbook file-size limit changed unexpectedly.');
p7_expect(SchoolWorkbookImportService::MAX_STUDENT_ROWS === 50_000, 'Workbook row limit changed unexpectedly.');
p7_expect(StudentImportService::MAX_FILE_SIZE === 5_000_000, 'CSV file-size limit changed unexpectedly.');
p7_expect(StudentImportService::MAX_ROWS === 2_000, 'CSV row limit changed unexpectedly.');

$passwordHash = Security::hashPassword('phase7-password');
p7_expect($passwordHash !== 'phase7-password', 'Password hashing returned plaintext.');
p7_expect(Security::verifyPassword('phase7-password', $passwordHash), 'Generated password hash did not verify.');

$sessionDir = sys_get_temp_dir() . '/sams-phase7-sessions';
if (!is_dir($sessionDir) && !mkdir($sessionDir, 0700, true) && !is_dir($sessionDir)) {
    throw new RuntimeException('Unable to create Phase 7 session directory.');
}
ini_set('session.save_path', $sessionDir);
Security::startSession('SAMS_PHASE7', 3600);
$sessionIdBeforeLogin = session_id();
$csrfBeforeLogin = Csrf::token();

Auth::login([
    'id' => 1,
    'full_name' => 'Phase 7 Admin',
    'role' => 'admin',
    'session_version' => 1,
]);

p7_expect(Auth::check(), 'Freshly logged-in session was not authenticated.');
$sessionIdAfterLogin = session_id();
p7_expect($sessionIdAfterLogin !== '', 'Authenticated session has no session ID.');
p7_expect($sessionIdAfterLogin !== $sessionIdBeforeLogin, 'Login did not rotate the session ID.');

$csrf = Csrf::token();
p7_expect($csrf !== $csrfBeforeLogin, 'Login did not rotate the CSRF token.');
p7_expect($csrf !== '', 'Authenticated session did not receive a CSRF token.');
p7_expect(!Csrf::verify('wrong-token'), 'Invalid CSRF token was accepted.');
p7_expect(Csrf::verify($csrf), 'Valid CSRF token was rejected.');

$pdo->exec("UPDATE users SET session_version = 2 WHERE id = 1");
p7_expect(Auth::user() === null, 'Changed session_version did not invalidate the session.');

// Re-authenticate with the current database version for the remaining tests.
Auth::login([
    'id' => 1,
    'full_name' => 'Phase 7 Admin',
    'role' => 'admin',
    'session_version' => 2,
]);
p7_expect(Auth::check(), 'Session could not be re-established after version invalidation.');

$idleTimeout = max(
    300,
    (int)(($GLOBALS['appConfig']['session_idle_timeout'] ?? $GLOBALS['appConfig']['session_lifetime'] ?? 3600))
);
$_SESSION['_sams_session_last_activity'] = time() - $idleTimeout - 1;
$expired = Auth::user();
p7_expect($expired === null, 'Idle timeout did not invalidate the authenticated session.');

Auth::login([
      'id' => 1,
    'full_name' => 'Phase 7 Admin',
    'role' => 'admin',
    'session_version' => 2,
]);
p7_expect(Auth::check(), 'Session could not be re-established after idle timeout.');
$_SESSION['_sams_session_started_at'] = time() - 43201;
p7_expect(Auth::user() === null, 'Absolute session timeout did not invalidate the session.');

$loginService = new AuthService();
$inactiveError = p7_expect_exception(
    static fn() => $loginService->authenticate('phase7-inactive', 'anything', 15, 5),
    'Inactive user was allowed to authenticate.'
);
p7_expect(
    $inactiveError instanceof RuntimeException
        && $inactiveError->getMessage() === 'Invalid credentials.',
    'Inactive-user authentication leaked an unexpected error.'
);

Auth::login([
    'id' => 1,
    'full_name' => 'Phase 7 Admin',
    'role' => 'admin',
    'session_version' => 2,
]);
$pdo->exec("UPDATE users SET is_active = 0 WHERE id = 1");
p7_expect(Auth::user() === null, 'An inactive existing user session remained authenticated.');

// Repository-wide tracked secret/config path audit. Local runtime configs must stay ignored.
$tracked = shell_exec("git ls-files | grep -E '(^|/)(\.env$|\.env\\.[^/]+$|config/(app|database)\\.php$)' || true");
p7_expect(trim((string)$tracked) === '', 'Tracked local secret/config file detected: ' . trim((string)$tracked));

// Clean the synthetic session state before the test exits.
Auth::logout();
p7_expect(session_status() === PHP_SESSION_NONE, 'Logout did not destroy the PHP session.');
if (is_dir($sessionDir)) {
    foreach (glob($sessionDir . '/*') ?: [] as $file) {
        @unlink($file);
    }
    @rmdir($sessionDir);
}

echo "Phase 7 security/reliability integration: PASS\n";