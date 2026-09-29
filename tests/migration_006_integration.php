<?php

declare(strict_types=1);

$host = getenv('SAMS_TEST_DB_HOST') ?: '';
$port = getenv('SAMS_TEST_DB_PORT') ?: '3306';
$user = getenv('SAMS_TEST_DB_USER') ?: '';
$pass = getenv('SAMS_TEST_DB_PASS') ?: '';
$baseSchemaPath = getenv('SAMS_MIGRATION_BASE_SCHEMA') ?: '';
$migrationPath = __DIR__ . '/../database/migrations/006_school_auth_identity.sql';

if ($host === '' || $user === '' || $baseSchemaPath === '' || !is_file($baseSchemaPath)) {
    throw new RuntimeException('Migration test configuration is incomplete.');
}

if (!is_file($migrationPath)) {
    throw new RuntimeException('Migration 006 file is missing.');
}

function execute_sql(PDO $pdo, string $sql): void
{
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    $statements = preg_split('/;\s*(?:\R|$)/', $sql, -1, PREG_SPLIT_NO_EMPTY);

    foreach ($statements as $statement) {
        if (trim($statement) === '') continue;
        $pdo->exec($statement);
    }
}

function assert_true(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $host, (int)$port),
    $user,
    $pass,
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]
);

$database = 'sams_migration_006_test';
$pdo->exec('DROP DATABASE IF EXISTS ' . $database);
$pdo->exec(
    'CREATE DATABASE ' . $database . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
);

try {
    $baseSchema = file_get_contents($baseSchemaPath);
    $migration = file_get_contents($migrationPath);

    if ($baseSchema === false || $migration === false) {
        throw new RuntimeException('Unable to read migration test fixtures.');
    }

    $baseSchema = preg_replace('/\bUSE\s+sams\s*;/i', 'USE ' . $database . ';', $baseSchema) ?? $baseSchema;
    $migration = preg_replace('/\bUSE\s+sams\s*;/i', 'USE ' . $database . ';', $migration) ?? $migration;

    execute_sql($pdo, $baseSchema);

    $pdo->exec('USE ' . $database);

    $pdo->exec(
        "INSERT INTO academic_years (name, starts_on, ends_on, is_active)
         VALUES ('2026/2027', '2026-09-01', '2027-07-31', 1)"
    );
    $academicYearId = (int)$pdo->lastInsertId();

    $pdo->exec(
        "INSERT INTO users (username, full_name, password_hash, role, is_active)
         VALUES ('migration-006-teacher', 'Migration 006 Teacher', 'hash', 'teacher', 1)"
    );
    $userId = (int)$pdo->lastInsertId();

    $pdo->exec(
        "INSERT INTO classes (academic_year_id, name, level, branch)
         VALUES ({$academicYearId}, 'MIGRATION-006', '2BAC', 'SP')"
    );
    $classId = (int)$pdo->lastInsertId();

    $pdo->exec(
        "INSERT INTO students
            (class_id, student_number, massar_code, birth_date, first_name, last_name)
         VALUES ({$classId}, NULL, 'MIG-006', '2010-01-01', 'Migration', 'Student')"
    );
    $studentId = (int)$pdo->lastInsertId();

    $pdo->exec(
        "INSERT INTO student_enrollments (student_id, class_id, starts_on)
         VALUES ({$studentId}, {$classId}, '2026-09-01')"
    );
    $enrollmentId = (int)$pdo->lastInsertId();

    $pdo->exec(
        "INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
         VALUES ({$userId}, 'migration.seed', 'user', {$userId})"
    );

    execute_sql($pdo, $migration);

    $school = $pdo->query(
        "SELECT id, code, status FROM schools WHERE code = 'SAMS-001'"
    )->fetch();

    assert_true($school !== false, 'Migration 006 did not create the migrated school.');
    assert_true((string)$school['status'] === 'active', 'Migrated school is not active.');

    $migratedUser = $pdo->query(
        "SELECT school_id, account_status, password_hash
         FROM users WHERE id = {$userId}"
    )->fetch();

    assert_true($migratedUser !== false, 'Migrated user disappeared.');
    assert_true((int)$migratedUser['school_id'] === (int)$school['id'], 'User was not assigned to the migrated school.');
    assert_true((string)$migratedUser['account_status'] === 'active', 'User lifecycle state was not backfilled.');
    assert_true((string)$migratedUser['password_hash'] === 'hash', 'Existing password hash was not preserved.');

    $year = $pdo->query(
        "SELECT school_id FROM academic_years WHERE id = {$academicYearId}"
    )->fetchColumn();

    assert_true((int)$year === (int)$school['id'], 'Academic year was not assigned to the migrated school.');

    $codeCount = (int)$pdo->query(
        "SELECT COUNT(*) FROM sams_login_codes WHERE user_id = {$userId} AND revoked_at IS NULL"
    )->fetchColumn();

    assert_true($codeCount === 1, 'Exactly one initial SAMS Code was not issued to the migrated user.');

    $onboardingCodeCount = (int)$pdo->query(
        "SELECT COUNT(*) FROM school_onboarding_codes WHERE school_id = {$school['id']} AND revoked_at IS NULL"
    )->fetchColumn();

    assert_true($onboardingCodeCount === 1, 'Exactly one migrated onboarding code was not created.');

    $auditSchool = $pdo->query(
        "SELECT school_id FROM audit_logs WHERE user_id = {$userId} ORDER BY id DESC LIMIT 1"
    )->fetchColumn();

    assert_true((int)$auditSchool === (int)$school['id'], 'Existing audit ownership was not backfilled.');

    $attendanceForeignKeys = (int)$pdo->query(
        "SELECT COUNT(*)
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = " . $pdo->quote($database) . "
           AND TABLE_NAME = 'attendance'
           AND REFERENCED_TABLE_NAME IS NOT NULL"
    )->fetchColumn();

    assert_true($attendanceForeignKeys >= 4, 'Migration 006 damaged existing attendance foreign keys.');

    echo "[PASS] migration 006 upgrade test" . PHP_EOL;
} finally {
    $pdo->exec('DROP DATABASE IF EXISTS ' . $database);
}