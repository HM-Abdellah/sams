<?php

declare(strict_types=1);

require_once __DIR__ . '/../backend/vendor/autoload.php';

use SAMS\Controllers\ProfileController;
use SAMS\Helpers\Auth;
use SAMS\Helpers\Database;
use SAMS\Helpers\Security;
use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Routing\Router;

function avatar_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function avatar_execute_schema(PDO $pdo, string $sql): void
{
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    $sql = preg_replace('/CREATE DATABASE IF NOT EXISTS sams\s+CHARACTER SET utf8mb4\s+COLLATE utf8mb4_unicode_ci;\s*USE sams;\s*/i', '', $sql) ?? $sql;
    if (preg_match('/\bUSE\s+sams\s*;/i', $sql) === 1) {
        throw new RuntimeException('Refusing to run the production DB selector in the avatar integration test.');
    }
    $sql = preg_replace('/;(?=(?:CREATE|ALTER|DROP|SET|USE)\b)/i', ";\n", $sql) ?? $sql;
    $statements = preg_split('/;\s*(?:\R|$)/', $sql, -1, PREG_SPLIT_NO_EMPTY);
    foreach ($statements ?: [] as $statement) {
        if (trim($statement) !== '') {
            $pdo->exec($statement);
        }
    }
}

$pdo = Database::connection();
$schema = file_get_contents(__DIR__ . '/../database/schema.sql');
if ($schema === false) {
    throw new RuntimeException('Unable to load database schema.');
}
avatar_execute_schema($pdo, $schema);

$pdo->exec("INSERT INTO schools (code, name) VALUES ('AVATAR-TEST', 'Avatar Test School')");
$schoolId = (int)$pdo->lastInsertId();

$avatarBytes = base64_decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAADElEQVQImWNgYGAAAAAEAAGjChXjAAAAAElFTkSuQmCC',
    true
);
if ($avatarBytes === false) {
    throw new RuntimeException('Failed to build the synthetic PNG test fixture.');
}

$avatarName = 'sams-test-' . bin2hex(random_bytes(12)) . '.png';
$storageDir = dirname(__DIR__) . '/backend/storage/avatars';
if (!is_dir($storageDir) && !mkdir($storageDir, 0750, true) && !is_dir($storageDir)) {
    throw new RuntimeException('Cannot create the temporary avatar test directory.');
}
$avatarPath = $storageDir . DIRECTORY_SEPARATOR . $avatarName;
$relativePath = 'avatars/' . $avatarName;
$sessionStarted = false;

try {
    if (file_put_contents($avatarPath, $avatarBytes) !== strlen($avatarBytes)) {
        throw new RuntimeException('Cannot write the temporary avatar test image.');
    }

    $insert = $pdo->prepare(
        "INSERT INTO users
            (school_id, username, full_name, password_hash, role, account_status, is_active, avatar_path)
         VALUES (?, 'avatar.test', 'Avatar Test User', 'not-used-in-this-test', 'admin', 'active', 1, ?)"
    );
    $insert->execute([$schoolId, $relativePath]);
    $userId = (int)$pdo->lastInsertId();

    $userStmt = $pdo->prepare(
        'SELECT id, school_id, full_name, role, session_version FROM users WHERE id = ?'
    );
    $userStmt->execute([$userId]);
    $user = $userStmt->fetch();
    if (!is_array($user)) {
        throw new RuntimeException('Synthetic avatar user was not created.');
    }

    ini_set('session.save_path', sys_get_temp_dir());
    $GLOBALS['appConfig'] = [
        'session_name' => 'SAMSAVATARTEST',
        'session_lifetime' => 3600,
        'session_idle_timeout' => 3600,
        'session_absolute_timeout' => 7200,
    ];
    Security::startSession('SAMSAVATARTEST', 3600);
    $sessionStarted = true;
    Auth::login($user);

    // Exercise the same route adapter used by backend/public/index.php.
    $profile = new ProfileController();
    $router = new Router();
    $router->get('/profile/avatar', static function (Request $request, array $params = []) use ($profile): Response {
        return $profile($request, ['action' => 'avatar']);
    });
    $response = $router->dispatch(
        new Request('GET', '/profile/avatar', ['v' => $avatarName])
    );

    avatar_assert($response->status() === 200, "Profile avatar route should return HTTP 200 for the current user's stored image.");
    avatar_assert(
        ($response->headers()['Content-Type'] ?? '') === 'image/png',
        'Profile avatar route must return the image MIME type instead of JSON.'
    );
    avatar_assert($response->body() === $avatarBytes, 'Profile avatar route must return the original image bytes.');

    echo "[PASS] Profile avatar route returns image bytes with the correct content type." . PHP_EOL;
} finally {
    if ($sessionStarted && session_status() === PHP_SESSION_ACTIVE) {
        $_SESSION = [];
        session_destroy();
    }
    if (is_file($avatarPath)) {
        @unlink($avatarPath);
    }
}
