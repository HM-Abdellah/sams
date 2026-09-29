<?php

declare(strict_types=1);

$host = getenv('SAMS_TEST_DB_HOST') ?: '';
$port = (int)(getenv('SAMS_TEST_DB_PORT') ?: 3306);
$db = getenv('SAMS_TEST_DB_NAME') ?: '';
$user = getenv('SAMS_TEST_DB_USER') ?: '';
$pass = getenv('SAMS_TEST_DB_PASS') ?: '';

if ($host === '' || $db === '' || $user === '') {
    throw new RuntimeException('Missing SAMS_TEST_DB_* environment variables.');
}

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

function tenant_assert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function tenant_exec_schema(PDO $pdo, string $sql): void
{
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    $statements = preg_split('/;\s*(?:\R|$)/', $sql, -1, PREG_SPLIT_NO_EMPTY);
    foreach ($statements as $statement) {
        if (trim($statement) !== '') $pdo->exec($statement);
    }
}

$schema = file_get_contents(__DIR__ . '/../database/schema.sql');
tenant_assert($schema !== false, 'Unable to read schema.');
tenant_exec_schema($pdo, $schema);
$pdo->exec('USE ' . $db);

$pdo->exec("INSERT INTO schools (code, name) VALUES ('TEN-A', 'Tenant A'), ('TEN-B', 'Tenant B')");
$schoolIds = $pdo->query(
    "SELECT code, id FROM schools WHERE code IN ('TEN-A', 'TEN-B')"
)->fetchAll(PDO::FETCH_KEY_PAIR);
$schoolA = (int)$schoolIds['TEN-A'];
$schoolB = (int)$schoolIds['TEN-B'];

$yearStmt = $pdo->prepare(
    'INSERT INTO academic_years (school_id, name, starts_on, ends_on, is_active)
     VALUES (?, ?, ?, ?, 1)'
);
$yearStmt->execute([$schoolA, '2026/2027', '2026-09-01', '2027-07-31']);
$yearA = (int)$pdo->lastInsertId();
$yearStmt->execute([$schoolB, '2026/2027', '2026-09-01', '2027-07-31']);
$yearB = (int)$pdo->lastInsertId();

$userStmt = $pdo->prepare(
    "INSERT INTO users (school_id, username, full_name, password_hash, role, account_status, is_active)
     VALUES (?, ?, ?, 'hash', ?, 'active', 1)"
);
$userStmt->execute([$schoolA, 'tenant-a-admin', 'Tenant A Admin', 'admin']);
$adminA = (int)$pdo->lastInsertId();
$userStmt->execute([$schoolB, 'tenant-b-admin', 'Tenant B Admin', 'admin']);
$adminB = (int)$pdo->lastInsertId();
$userStmt->execute([$schoolA, 'tenant-a-teacher', 'Tenant A Teacher', 'teacher']);
$teacherA = (int)$pdo->lastInsertId();

$classStmt = $pdo->prepare(
    'INSERT INTO classes (academic_year_id, name, level, branch)
     VALUES (?, ?, ?, ?)'
);
$classStmt->execute([$yearA, 'TEN-A-CLASS', '2BAC', 'SP']);
$classA = (int)$pdo->lastInsertId();
$classStmt->execute([$yearB, 'TEN-B-CLASS', '2BAC', 'SP']);
$classB = (int)$pdo->lastInsertId();

$pdo->prepare(
    'INSERT INTO teacher_classes (teacher_id, class_id) VALUES (?, ?)'
)->execute([$teacherA, $classB]);

require_once __DIR__ . '/../backend/vendor/autoload.php';

use SAMS\Repositories\AcademicYearRepository;
use SAMS\Repositories\ClassRepository;

$academicYears = new AcademicYearRepository();
$classes = new ClassRepository();
$allYears = $academicYears->all();
tenant_assert(count($allYears) === 2, 'Baseline fixture did not create two academic years.');

$adminClasses = $classes->allForAdmin();
tenant_assert(count($adminClasses) === 2, 'Baseline fixture did not create two classes.');

$teacherClasses = $classes->forUser($teacherA, 'teacher');

$leakedClassIds = array_map(
    static fn(array $row): int => (int)$row['id'],
    $teacherClasses
);

tenant_assert(
    in_array($classB, $leakedClassIds, true),
    'RED test is not exercising the malicious cross-school teacher assignment.'
);

tenant_assert(
    $classes->hasAccess($teacherA, 'teacher', $classB),
    'RED test is not exercising the cross-school teacher access path.'
);

echo "[PASS-RED-BASELINE] Tenant isolation fixture exposes the pre-fix leak." . PHP_EOL;