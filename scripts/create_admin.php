<?php
/**
 * SAMS local development bootstrap.
 *
 * Run from the project root:
 *   php scripts/create_admin.php
 *
 * This script deliberately keeps the admin password out of Git.
 */
declare(strict_types=1);

require_once __DIR__ . '/../backend/src/bootstrap.php';

use SAMS\Helpers\Database;

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script must be executed from the command line.\n");
    exit(1);
}

try {
    $pdo = Database::connection();
    $username = 'admin';
    $fullName = 'SAMS Administrator';

    $schoolId = $pdo->query(
        "SELECT id FROM schools WHERE status = 'active' ORDER BY id LIMIT 1"
    )->fetchColumn();

    if ($schoolId === false) {
        $schoolStmt = $pdo->prepare(
            "INSERT INTO schools (code, name, status) VALUES (?, ?, 'active')"
        );
        $schoolStmt->execute(['SAMS-LOCAL', 'SAMS Development School']);
        $schoolId = (int)$pdo->lastInsertId();
    }

    $schoolId = (int)$schoolId;

    fwrite(STDOUT, "Enter a new admin password: ");
    $password = trim((string)fgets(STDIN));
    if (strlen($password) < 10) {
        throw new RuntimeException('Password must contain at least 10 characters.');
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    if ($hash === false) throw new RuntimeException('Password hashing failed.');

    $stmt = $pdo->prepare(
        'INSERT INTO users (school_id, username, full_name, password_hash, role, account_status, is_active)
         VALUES (?, ?, ?, ?, \'admin\', \'active\', 1)
         ON DUPLICATE KEY UPDATE school_id=VALUES(school_id), full_name=VALUES(full_name), password_hash=VALUES(password_hash), role=\'admin\', account_status=\'active\', is_active=1'
    );
    $stmt->execute([$schoolId, $username, $fullName, $hash]);

    fwrite(STDOUT, "Admin account ready: {$username}\n");
} catch (Throwable $e) {
    fwrite(STDERR, "Bootstrap failed: {$e->getMessage()}\n");
    exit(1);
}
