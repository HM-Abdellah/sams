<?php

declare(strict_types=1);

$host = getenv('SAMS_TEST_DB_HOST') ?: '';
$port = (int)(getenv('SAMS_TEST_DB_PORT') ?: 3306);
$user = getenv('SAMS_TEST_DB_USER') ?: '';
$pass = getenv('SAMS_TEST_DB_PASS') ?: '';
$baseSchemaPath = getenv('SAMS_MIGRATION_BASE_SCHEMA') ?: '';
$migrationPath = __DIR__ . '/../database/migrations/009_attendance_concurrency_revisions.sql';

if ($host === '' || $user === '' || $baseSchemaPath === '' || !is_file($baseSchemaPath)) {
    throw new RuntimeException('Migration 009 test configuration is incomplete.');
}
if (!is_file($migrationPath)) {
    throw new RuntimeException('Migration 009 file is missing.');
}

function m9_execute(PDO $pdo, string $sql): void
{
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    foreach (preg_split('/;\s*(?:\R|$)/', $sql, -1, PREG_SPLIT_NO_EMPTY) as $statement) {
        if (trim($statement) !== '') {
            $pdo->exec($statement);
        }
    }
}

function m9_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
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

$database = 'sams_migration_009_test';
$pdo->exec('DROP DATABASE IF EXISTS ' . $database);
$pdo->exec('CREATE DATABASE ' . $database . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');

try {
    $baseSchema = file_get_contents($baseSchemaPath);
    $migration = file_get_contents($migrationPath);
    m9_assert($baseSchema !== false && $migration !== false, 'Unable to read migration test SQL.');

    $baseSchema = preg_replace('/\bUSE\s+sams\s*;/i', 'USE ' . $database . ';', $baseSchema) ?? $baseSchema;
    $migration = preg_replace('/\bUSE\s+sams\s*;/i', 'USE ' . $database . ';', $migration) ?? $migration;

    m9_execute($pdo, $baseSchema);

    $before = (int)$pdo->query(
        "SELECT COUNT(*) FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = " . $pdo->quote($database) . "
           AND TABLE_NAME = 'attendance_register_revisions'"
    )->fetchColumn();
    m9_assert($before === 0, 'Release baseline unexpectedly contains Phase 38 revision table.');

    m9_execute($pdo, $migration);

    $columns = $pdo->query(
        "SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = " . $pdo->quote($database) . "
           AND TABLE_NAME = 'attendance_register_revisions'
         ORDER BY ORDINAL_POSITION"
    )->fetchAll(PDO::FETCH_COLUMN);
    m9_assert(
        $columns === ['id', 'class_id', 'attendance_date', 'period', 'revision', 'created_at', 'updated_at'],
        'Migration 009 created an unexpected column set.'
    );

    $foreignKeys = (int)$pdo->query(
        "SELECT COUNT(*)
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = " . $pdo->quote($database) . "
           AND TABLE_NAME = 'attendance_register_revisions'
           AND REFERENCED_TABLE_NAME IS NOT NULL"
    )->fetchColumn();
    m9_assert($foreignKeys === 1, 'Migration 009 did not create the expected class foreign key.');

    $pdo->exec(
        "INSERT INTO academic_years (name, starts_on, ends_on, is_active)
         VALUES ('2026/2027', '2026-09-01', '2027-07-31', 1)"
    );
    $academicYearId = (int)$pdo->lastInsertId();

    $pdo->exec(
        "INSERT INTO classes (academic_year_id, name, level, branch)
         VALUES ({$academicYearId}, 'MIGRATION-009', '2BAC', 'SP')"
    );
    $classId = (int)$pdo->lastInsertId();

    $pdo->exec(
        "INSERT INTO attendance_register_revisions
            (class_id, attendance_date, period, revision)
         VALUES ({$classId}, '2026-09-23', 1, 1)"
    );

    $revision = (int)$pdo->query(
        "SELECT revision
         FROM attendance_register_revisions
         WHERE class_id = {$classId}
           AND attendance_date = '2026-09-23'
           AND period = 1"
    )->fetchColumn();
    m9_assert($revision === 1, 'Migration 009 revision row could not be persisted.');

    echo "[PASS] migration 009 attendance concurrency revision upgrade test" . PHP_EOL;
} finally {
    $pdo->exec('DROP DATABASE IF EXISTS ' . $database);
}
