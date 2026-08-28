<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Response;
use SAMS\Repositories\ClassRepository;
use SAMS\Repositories\StudentRepository;
use SAMS\Services\StudentService;

try {
    $user = Auth::requireLogin();
    $classId = (int)($_GET['class_id'] ?? 0);
    if ($classId < 1) Response::error('Invalid class.', 422);
    if (!(new ClassRepository())->hasAccess((int)$user['id'], (string)$user['role'], $classId)) Response::error('Forbidden.', 403);

    $repo = new StudentRepository();
    $method = sams_method();
    if ($method === 'GET') Response::success(['students' => $repo->forClass($classId)]);

    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) Response::error('Invalid CSRF token.', 419);
    $body = sams_json_body();
    $action = (string)($body['action'] ?? '');

    if ($action === 'create' && in_array($user['role'], ['admin', 'teacher'], true)) {
        $service = new StudentService();
        $first = $service->validateName((string)($body['first_name'] ?? ''), 'first_name');
        $last = $service->validateName((string)($body['last_name'] ?? ''), 'last_name');
        $number = $service->normalizeNumber(isset($body['student_number']) ? (string)$body['student_number'] : null);
        try {
            $id = $repo->create($classId, $number, $first, $last);
        } catch (PDOException $e) {
            if ((int)($e->errorInfo[1] ?? 0) === 1062) Response::error('Student number already exists in this class.', 409);
            throw $e;
        }
        Response::success(['id' => $id], 201);
    }

    if ($action === 'delete') {
        Auth::requireRole('admin');
        $studentId = (int)($body['id'] ?? 0);
        if ($studentId < 1) Response::error('Invalid student.', 422);
        if (!$repo->findInClass($studentId, $classId)) Response::error('Student not found.', 404);
        $repo->deactivate($studentId, $classId);
        Response::success();
    }

    Response::error('Unknown action.', 400);
} catch (Throwable $e) {
    error_log('[SAMS students] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
