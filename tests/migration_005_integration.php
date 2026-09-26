<?php

declare(strict_types=1);

$host = getenv('SAMS_TEST_DB_HOST') ?: '';
$port = getenv('SAMS_TEST_DB_PORT') ?: '3306';
$user = getenv('SAMS_TEST_DB_USER') ?: '';
$pass = getenv('SAMS_TEST_DB_PASS') ?: '';
$baseSchemaPath = getenv('SAMS_MIGRATION_BASE_SCHEMA') ?: '';
$migrationPath = __DIR__ . '/../database/migrations/005_school_import_staging.sql';

if ($host === '' || $user === '' || $baseSchemaPath === '' || !is_file($baseSchemaPath)) {
    throw new RuntimeException('Migration test configuration is incomplete.');
}

if (!is_file($migrationPath)) {
    throw new RuntimeException('Migration 005 file is missing.');
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
    if (!$condition) {
        throw new RuntimeException($message);
    }
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

$database = 'sams_migration_005_test';
$pdo->exec('DROP DATABASE IF EXISTS ' . $database);
$pdo->exec(
    'CREATE DATABASE ' . $database . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
);

try {
    $baseSchema = file_get_contents($baseSchemaPath);
    if ($baseSchema === false) {
        throw new RuntimeException('Unable to read Phase 2 base schema.');
    }

    $migration = file_get_contents($migrationPath);
    if ($migration === false) {
        throw new RuntimeException('Unable to read migration 005.');
    }

    $baseSchema = preg_replace('/\bUSE\s+sams\s*;/i', 'USE ' . $database . ';', $baseSchema) ?? $baseSchema;
    $migration = preg_replace('/\bUSE\s+sams\s*;/i', 'USE ' . $database . ';', $migration) ?? $migration;

    execute_sql($pdo, $baseSchema);

    $before = $pdo->query(
        "SELECT COUNT(*) FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = " . $pdo->quote($database) . "
           AND TABLE_NAME IN ('school_import_batches', 'school_import_classes', 'school_import_rows')"
    )->fetchColumn();
    assert_true((int)$before === 0, 'Phase 2 base schema unexpectedly contains school import tables.');

    execute_sql($pdo, $migration);

    $tables = $pdo->query(
        "SELECT TABLE_NAME
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = " . $pdo->quote($database) . "
           AND TABLE_NAME IN ('school_import_batches', 'school_import_classes', 'school_import_rows')
         ORDER BY TABLE_NAME"
    )->fetchAll(PDO::FETCH_COLUMN);

    assert_true(
        $tables === ['school_import_batches', 'school_import_classes', 'school_import_rows'],
        'Migration 005 did not create the expected staging tables.'
    );

    $foreignKeys = (int)$pdo->query(
        "SELECT COUNT(*)
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = " . $pdo->quote($database) . "
           AND TABLE_NAME IN ('school_import_batches', 'school_import_classes', 'school_import_rows')
           AND REFERENCED_TABLE_NAME IS NOT NULL"
    )->fetchColumn();

    assert_true($foreignKeys === 5, 'Migration 005 created an unexpected foreign-key set.');

    $pdo->exec(
        'USE ' . $database
    );

    $pdo->exec(
        "INSERT INTO academic_years (name, starts_on, ends_on, is_active)
         VALUES ('2026/2027', '2026-09-01', '2027-07-31', 1)"
    );
    $academicYearId = (int)$pdo->lastInsertId();

    $pdo->exec(
        "INSERT INTO users (username, full_name, password_hash, role)
         VALUES ('migration-admin', 'Migration Admin', 'hash', 'admin')"
    );
    $userId = (int)$pdo->lastInsertId();

    $pdo->exec(
        "INSERT INTO classes (academic_year_id, name, level, branch)
         VALUES ({$academicYearId}, 'MIGRATION-005', '2BAC', 'SP')"
    );
    $classId = (int)$pdo->lastInsertId();

    $pdo->exec(
        "INSERT INTO students
            (class_id, student_number, massar_code, birth_date, first_name, last_name)
         VALUES ({$classId}, NULL, 'MIG-005', '2010-01-01', 'Migration', 'Student')"
    );
    $studentId = (int)$pdo->lastInsertId();

    $pdo->exec(
        "INSERT INTO student_enrollments (student_id, class_id, starts_on)
         VALUES ({$studentId}, {$classId}, '2026-09-01')"
    );
    $enrollmentId = (int)$pdo->lastInsertId();

    $pdo->exec(
        "INSERT INTO school_import_batches
            (created_by, target_academic_year_id, source_academic_year,
             original_filename, file_sha256, file_size, status)
         VALUES
            ({$userId}, {$academicYearId}, '2025/2026',
             'migration-test.xlsx', '" . str_repeat('a', 64) . "', 100, 'validated')"
    );
    $batchId = (int)$pdo->lastInsertId();

    $pdo->exec(
        "INSERT INTO school_import_classes
            (batch_id, source_sheet, source_block_start_row, source_block_end_row,
             source_class_name, source_level, source_academic_year,
             target_class_id, status, student_count)
         VALUES
            ({$batchId}, 'Migration', 1, 5, 'MIGRATION-005', '2BAC',
             '2025/2026', {$classId}, 'mapped', 1)"
    );
    $importClassId = (int)$pdo->lastInsertId();

    $pdo->exec(
        "INSERT INTO school_import_rows
            (import_class_id, source_row, roster_number, first_name, last_name,
             massar_code, birth_date, status, match_status,
             matched_student_id, target_enrollment_id)
         VALUES
            ({$importClassId}, 5, '1', 'Migration', 'Student',
             'MIG-005', '2010-01-01', 'matched', 'existing',
             {$studentId}, {$enrollmentId})"
    );

    assert_true(
        (int)$pdo->query('SELECT COUNT(*) FROM school_import_rows')->fetchColumn() === 1,
        'Migration 005 staging tables could not persist linked data.'
    );

    echo "[PASS] migration 005 upgrade test" . PHP_EOL;
} finally {
    $pdo->exec('DROP DATABASE IF EXISTS ' . $database);
}
