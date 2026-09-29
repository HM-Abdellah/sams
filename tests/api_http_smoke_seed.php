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
    sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $host, $port),
    $user,
    $pass,
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]
);

function http_seed_schema(PDO $pdo, string $sql): void
{
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    foreach (preg_split('/;\s*(?:\R|$)/', $sql, -1, PREG_SPLIT_NO_EMPTY) as $statement) {
        if (trim($statement) !== '') $pdo->exec($statement);
    }
}
$schema = file_get_contents(__DIR__ . '/../database/schema.sql');
if ($schema === false) {
    throw new RuntimeException('Unable to read schema.');
}
http_seed_schema($pdo, $schema);

$pdo->beginTransaction();
try {
    $pdo->exec("INSERT INTO schools (code, name)
        VALUES ('HTTP-001', 'HTTP Smoke School')");
    $schoolId = (int)$pdo->lastInsertId();

    $yearStmt = $pdo->prepare("INSERT INTO academic_years
        (school_id, name, starts_on, ends_on, is_active)
        VALUES (?, '2026/2027', '2026-09-01', '2027-07-31', 1)");
    $yearStmt->execute([$schoolId]);
    $yearId = (int)$pdo->lastInsertId();

    $userStmt = $pdo->prepare("INSERT INTO users
        (school_id, username, employee_id, full_name, password_hash, role, account_status, is_active, session_version)
    VALUES (?, ?, ?, ?, ?, ?, 'active', 1, 1)");
    $users = [
        ['http-admin', 'HTTPA', 'HTTP Admin', 'synthetic-admin-hash', 'admin'],
        ['http-teacher', 'HTTPT', 'HTTP Teacher', 'synthetic-teacher-hash', 'teacher'],
        ['http-observer', 'HTTPO', 'HTTP Observer', 'synthetic-observer-hash', 'teacher'],
        ['http-counselor', 'HTTPC', 'HTTP Counselor', 'synthetic-counselor-hash', 'counselor'],
    ];
    foreach ($users as [$username, $employeeId, $fullName, $passwordHash, $role]) {
        $userStmt->execute([$schoolId, $username, $employeeId, $fullName, $passwordHash, $role]);
    }

    $pdo->prepare("INSERT INTO classes (academic_year_id, name, level, branch, is_active)
        VALUES (?, 'HTTP-A', '2BAC', 'SP', 1)")->execute([$yearId]);
    $pdo->exec('INSERT INTO teacher_classes (teacher_id, class_id) VALUES (2, 1)');

    $pdo->exec("INSERT INTO students
        (class_id, student_number, massar_code, birth_date, first_name, last_name, status)
        VALUES (1, 'HTTP001', 'HTTPM001', '2010-01-01', 'Synthetic', 'Student', 'active')");
    $pdo->exec("INSERT INTO student_enrollments
        (student_id, class_id, starts_on) VALUES (1, 1, '2026-09-01')");

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
}

echo "[PASS] HTTP smoke fixture seeded\n";