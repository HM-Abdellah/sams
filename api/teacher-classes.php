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
use SAMS\Repositories\TeacherClassRepository;
use SAMS\Repositories\UserRepository;
use Throwable;

try {
    $admin = Auth::requireRole('admin');
    $repo = new TeacherClassRepository();
    $users = new UserRepository();
    $classes = new ClassRepository();
    $audit = new AuditLogRepository();
    $method = sams_method();

    if ($method === 'GET') {
        $classId = (int)($_GET['class_id'] ?? 0);
        $teacherId = (int)($_GET['teacher_id'] ?? 0);

        if ($classId > 0) {
            Response::success(['teachers' => $repo->forClass($classId)]);
        }

        if ($teacherId > 0) {
            Response::success(['classes' => $repo->forTeacher($teacherId)]);
        }

        Response::error('Provide class_id or teacher_id.', 422);
    }

    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }

    $body = sams_json_body();
    $teacherId = (int)($body['teacher_id'] ?? 0);
    $classId = (int)($body['class_id'] ?? 0);

    if ($teacherId < 1 || $classId < 1) {
        Response::error('Invalid teacher or class.', 422);
    }

    $teacher = $users->findById($teacherId);
    $class = $classes->find($classId);

    if ($teacher === null || (string)$teacher['role'] !== 'teacher' || !(bool)$teacher['is_active']) {
        Response::error('Teacher not found or inactive.', 404);
    }

    if ($class === null || !(bool)$class['is_active']) {
        Response::error('Class not found or inactive.', 404);
    }

    $pdo = Database::connection();

    if ($method === 'POST') {
        if ($repo->exists($teacherId, $classId)) {
            Response::success(['changed' => false]);
        }

        $pdo->beginTransaction();
        try {
            $repo->assign($teacherId, $classId);
            $audit->record(
                (int)$admin['id'],
                'teacher_class.assign',
                'class',
                $classId,
                ['teacher_id' => $teacherId]
            );
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();

            if ($e instanceof PDOException && (int)($e->errorInfo[1] ?? 0) === 1062) {
                Response::success(['changed' => false]);
            }

            throw $e;
        }

        Response::success(['changed' => true]);
    }

    if ($method === 'DELETE') {
        if (!$repo->exists($teacherId, $classId)) {
            Response::success(['changed' => false]);
        }

        $pdo->beginTransaction();
        try {
            $repo->unassign($teacherId, $classId);
            $audit->record(
                (int)$admin['id'],
                'teacher_class.unassign',
                'class',
                $classId,
                ['teacher_id' => $teacherId]
            );
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        Response::success(['changed' => true]);
    }

    Response::error('Method not allowed.', 405);
} catch (InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[SAMS assignments] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
