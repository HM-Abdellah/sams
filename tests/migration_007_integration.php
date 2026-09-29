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

$database = 'sams_migration_007_test';
$pdo->exec('DROP DATABASE IF EXISTS ' . $database);
$pdo->exec('CREATE DATABASE ' . $database . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
try {
    $schema = file_get_contents(__DIR__ . '/../database/schema.sql');
    if ($schema === false) throw new RuntimeException('Unable to read schema.');
    $schema = preg_replace('/\bUSE\s+sams\s*;/i', 'USE ' . $database . ';', $schema) ?? $schema;
    execute_sql($pdo, $schema);
    $pdo->exec('USE ' . $database);

    $pdo->exec("INSERT INTO schools (code, name) VALUES ('MIG-007', 'Migration 007 School')");
    $pdo->exec("INSERT INTO users (school_id, username, full_name, password_hash, role) VALUES (1, 'mig-007', 'Migration 007', 'hash', 'teacher')");
    $userId = (int)$pdo->lastInsertId();
    $predictableHash = hash('sha256', 'T00001');
    $randomHash = hash('sha256', 'T999999');
    $codeStmt = $pdo->prepare('INSERT INTO sams_login_codes (user_id, code_hash) VALUES (?, ?)');
    $codeStmt->execute([$userId, $predictableHash]);
    $codeStmt->execute([$userId, $randomHash]);

    $migration = file_get_contents(__DIR__ . '/../database/migrations/007_revoke_predictable_login_codes.sql');
    if ($migration === false) throw new RuntimeException('Unable to read migration 007.');
    $migration = preg_replace('/\bUSE\s+sams\s*;/i', 'USE ' . $database . ';', $migration) ?? $migration;
    execute_sql($pdo, $migration);
    $codes = $pdo->query("SELECT code_hash, revoked_at FROM sams_login_codes WHERE user_id = {$userId} ORDER BY id")->fetchAll();
    assert_true(count($codes) === 2, 'Migration 007 test fixture did not preserve both credential rows.');
    assert_true($codes[0]['code_hash'] === $predictableHash && $codes[0]['revoked_at'] !== null, 'Migration 007 did not revoke the legacy predictable login code.');
    assert_true($codes[1]['code_hash'] === $randomHash && $codes[1]['revoked_at'] === null, 'Migration 007 revoked a non-predictable SAMS Code.');

    echo "[PASS] migration 007 upgrade test" . PHP_EOL;
} finally {
    $pdo->exec('DROP DATABASE IF EXISTS ' . $database);
}
