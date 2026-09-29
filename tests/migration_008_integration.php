<?php

declare(strict_types=1);

$host = getenv('SAMS_TEST_DB_HOST') ?: '';
$port = (int)(getenv('SAMS_TEST_DB_PORT') ?: 3306);
$user = getenv('SAMS_TEST_DB_USER') ?: '';
$pass = getenv('SAMS_TEST_DB_PASS') ?: '';
if ($host === '' || $user === '') throw new RuntimeException('Migration test configuration is incomplete.');

function execute_sql(PDO $pdo, string $sql): void
{
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    foreach (preg_split('/;\s*(?:\R|$)/', $sql, -1, PREG_SPLIT_NO_EMPTY) as $statement) {
        if (trim($statement) !== '') $pdo->exec($statement);
    }
}

function assert_true(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $host, $port),
    $user,
    $pass,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);

$database = 'sams_migration_008_test';
$pdo->exec('DROP DATABASE IF EXISTS ' . $database);
$pdo->exec('CREATE DATABASE ' . $database . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
try {
    $schema = file_get_contents(__DIR__ . '/../database/schema.sql');
    if ($schema === false) throw new RuntimeException('Unable to read schema.');
    $schema = preg_replace('/\bUSE\s+sams\s*;/i', 'USE ' . $database . ';', $schema) ?? $schema;
    execute_sql($pdo, $schema);
    $pdo->exec('USE ' . $database);

    $pdo->exec('ALTER TABLE teacher_onboarding_requests DROP INDEX idx_teacher_onboarding_rate_limit, DROP COLUMN request_ip, DROP COLUMN request_user_agent');

    $migration = file_get_contents(__DIR__ . '/../database/migrations/008_onboarding_rate_limit_metadata.sql');
    if ($migration === false) throw new RuntimeException('Unable to read migration 008.');
    $migration = preg_replace('/\bUSE\s+sams\s*;/i', 'USE ' . $database . ';', $migration) ?? $migration;
    execute_sql($pdo, $migration);

    $columns = $pdo->query("SELECT column_name FROM information_schema.columns WHERE table_schema = '{$database}' AND table_name = 'teacher_onboarding_requests' AND column_name IN ('request_ip','request_user_agent') ORDER BY column_name")->fetchAll(PDO::FETCH_COLUMN);
    assert_true($columns === ['request_ip','request_user_agent'], 'Migration 008 did not restore onboarding request metadata columns.');

    $index = $pdo->query("SELECT index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns FROM information_schema.statistics WHERE table_schema = '{$database}' AND table_name = 'teacher_onboarding_requests' AND index_name = 'idx_teacher_onboarding_rate_limit' GROUP BY index_name")->fetch();
    assert_true($index !== false && (string)$index['columns'] === 'request_ip,created_at,school_id', 'Migration 008 created the wrong rate-limit index.');

    echo "[PASS] migration 008 upgrade test" . PHP_EOL;
} finally {
    $pdo->exec('DROP DATABASE IF EXISTS ' . $database);
}
