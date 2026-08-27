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

require_once __DIR__ . '/../app/Helpers/Database.php';
use SAMS\Helpers\Database;

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script must be executed from the command line.\n");
    exit(1);
}

try {
    $pdo = Database::connection();
    $username = 'admin';
    $fullName = 'SAMS Administrator';

    fwrite(STDOUT, "Enter a new admin password: ");
    $password = trim((string)fgets(STDIN));
    if (strlen($password) < 10) {
        throw new RuntimeException('Password must contain at least 10 characters.');
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    if ($hash === false) throw new RuntimeException('Password hashing failed.');

    $stmt = $pdo->prepare(
        'INSERT INTO users (username, full_name, password_hash, role, is_active)
         VALUES (?, ?, ?, \'admin\', 1)
         ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), password_hash=VALUES(password_hash), role=\'admin\', is_active=1'
    );
    $stmt->execute([$username, $fullName, $hash]);

    fwrite(STDOUT, "Admin account ready: {$username}\n");
} catch (Throwable $e) {
    fwrite(STDERR, "Bootstrap failed: {$e->getMessage()}\n");
    exit(1);
}
