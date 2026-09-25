<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use PDOException;
use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Database;
use SAMS\Helpers\Response;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\ClassRepository;
use SAMS\Repositories\StudentRepository;
use SAMS\Services\StudentService;
use Throwable;

try {
    $user = Auth::requireLogin();
    $classId = (int)($_GET['class_id'] ?? 0);

    if ($classId < 1) Response::error('Invalid class.', 422);

    if (!(new ClassRepository())->hasAccess(
        (int)$user['id'],
        (string)$user['role'],
        $classId
    )) {
        Response::error('Forbidden.', 403);
    }

    $repo = new StudentRepository();
    $method = sams_method();

    if ($method === 'GET') {
        Response::success(['students' => $repo->forClass($classId)]);
    }

    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }

    $body = sams_json_body();
    $action = (string)($body['action'] ?? '');
    $audit = new AuditLogRepository();

    if ($action === 'create') {
        Auth::requireRole('admin', 'teacher');

        $service = new StudentService();
        $first = $service->validateName((string)($body['first_name'] ?? ''), 'first_name');
        $last = $service->validateName((string)($body['last_name'] ?? ''), 'last_name');
        $number = $service->normalizeNumber(
            isset($body['student_number']) ? (string)$body['student_number'] : null
        );

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $id = $repo->create($classId, $number, $first, $last);
            $audit->record(
                (int)$user['id'],
                'student.create',
                'student',
                $id,
                ['class_id' => $classId]
            );
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();

            if ($e instanceof PDOException && (int)($e->errorInfo[1] ?? 0) === 1062) {
                Response::error('Student number already exists in this class.', 409);
            }

            throw $e;
        }

        Response::success(['id' => $id], 201);
    }

    if ($action === 'delete') {
        $user = Auth::requireRole('admin');
        $studentId = (int)($body['id'] ?? 0);

        if ($studentId < 1) Response::error('Invalid student.', 422);

        $student = $repo->findInClass($studentId, $classId);
        if ($student === null) Response::error('Student not found.', 404);

        if ((string)$student['status'] === 'inactive') {
            Response::success(['changed' => false]);
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $repo->deactivate($studentId, $classId);
            $audit->record(
                (int)$user['id'],
                'student.deactivate',
                'student',
                $studentId,
                ['class_id' => $classId]
            );
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        Response::success(['changed' => true]);
    }

    Response::error('Unknown action.', 400);
} catch (Throwable $e) {
    error_log('[SAMS students] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
