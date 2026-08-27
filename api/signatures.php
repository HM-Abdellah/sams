<?php
declare(strict_types=1);
session_start();
require_once __DIR__ . '/../app/Helpers/Database.php';
require_once __DIR__ . '/../app/Helpers/Auth.php';
require_once __DIR__ . '/../app/Helpers/Csrf.php';
require_once __DIR__ . '/../app/Helpers/Response.php';
use SAMS\Helpers\Database;
use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Response;
header('Content-Type: application/json; charset=UTF-8');
try {
    $user = Auth::requireLogin();
    $classId = (int)($_GET['class_id'] ?? 0);
    if ($classId < 1) Response::error('Invalid class.', 422);
    $pdo = Database::connection();
    $check = $pdo->prepare($user['role'] === 'admin' || $user['role'] === 'counselor'
        ? 'SELECT 1 FROM classes WHERE id=? AND is_active=1'
        : 'SELECT 1 FROM classes c JOIN teacher_classes tc ON tc.class_id=c.id WHERE c.id=? AND c.is_active=1 AND tc.teacher_id=?');
    $check->execute($user['role'] === 'admin' || $user['role'] === 'counselor' ? [$classId] : [$classId, $user['id']]);
    if (!$check->fetchColumn()) Response::error('Forbidden.', 403);
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $q = $pdo->prepare('SELECT signature_data, mime_type, updated_at FROM signatures WHERE teacher_id=? AND class_id=? LIMIT 1');
        $q->execute([$user['id'], $classId]);
        Response::success(['signature' => $q->fetch() ?: null]);
    }
    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) Response::error('Invalid CSRF token.', 419);
    $body = json_decode((string)file_get_contents('php://input'), true) ?? [];
    $data = (string)($body['signature_data'] ?? '');
    if (!preg_match('/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/', $data)) Response::error('Invalid signature format.', 422);
    if (strlen($data) > 500000) Response::error('Signature is too large.', 422);
    $q = $pdo->prepare('INSERT INTO signatures (teacher_id,class_id,signature_data,mime_type) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE signature_data=VALUES(signature_data), mime_type=VALUES(mime_type), updated_at=CURRENT_TIMESTAMP');
    $q->execute([$user['id'], $classId, $data, 'image/png']);
    Response::success();
} catch (Throwable $e) {
    Response::error('Server error.', 500);
}
