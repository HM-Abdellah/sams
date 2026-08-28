<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Response;
use SAMS\Repositories\AttendanceRepository;
use SAMS\Repositories\ClassRepository;
use SAMS\Repositories\StudentRepository;
use SAMS\Services\AttendanceService;

try {
    $user = Auth::requireLogin();
    $classId = (int)($_GET['class_id'] ?? 0);
    if ($classId < 1) Response::error('Invalid class.', 422);

    $classes = new ClassRepository();
    if (!$classes->hasAccess((int)$user['id'], (string)$user['role'], $classId)) Response::error('Forbidden.', 403);

    $method = sams_method();
    $repo = new AttendanceRepository();

    if ($method === 'GET') {
        $month = (string)($_GET['month'] ?? '');
        if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) Response::error('Invalid month.', 422);
        Response::success(['attendance' => $repo->forClassMonth($classId, $month)]);
    }

    if (!in_array((string)$user['role'], ['admin', 'teacher'], true)) Response::error('Forbidden.', 403);
    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) Response::error('Invalid CSRF token.', 419);

    $body = sams_json_body();
    $studentId = (int)($body['student_id'] ?? 0);
    $date = (string)($body['attendance_date'] ?? '');
    $period = (int)($body['period'] ?? 0);
    $action = (string)($body['action'] ?? 'upsert');
    $studentRepo = new StudentRepository();
    if (!$studentRepo->findInClass($studentId, $classId)) Response::error('Student not found.', 404);

    $service = new AttendanceService();
    if ($action === 'delete' || $method === 'DELETE') {
        $service->validate($studentId, $date, $period, 'present');
        $repo->delete($studentId, $date, $period);
        Response::success();
    }

    $status = (string)($body['status'] ?? '');
    $service->validate($studentId, $date, $period, $status);
    $repo->upsert($studentId, $date, $period, $status, (int)$user['id']);
    Response::success();
} catch (InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[SAMS attendance] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
