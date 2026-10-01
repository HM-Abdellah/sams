<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Response;
use SAMS\Services\TeacherClassAdministrationService;

try {
    $admin = Auth::requireRole('admin');
    $service = new TeacherClassAdministrationService();
    $schoolId = (int)$admin['school_id'];
    $method = sams_method();

    if ($method === 'GET') {
        $classId = (int)($_GET['class_id'] ?? 0);
        $teacherId = (int)($_GET['teacher_id'] ?? 0);

        if ($classId > 0) {
            Response::success(['teachers' => $service->forClass($classId, $schoolId)]);
        }

        if ($teacherId > 0) {
            Response::success(['classes' => $service->forTeacher($teacherId, $schoolId)]);
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

    if ($method === 'POST') {
        Response::success([
            'changed' => $service->assign(
                (int)$admin['id'],
                $teacherId,
                $classId,
                $schoolId
            ),
        ]);
    }

    if ($method === 'DELETE') {
        Response::success([
            'changed' => $service->unassign(
                (int)$admin['id'],
                $teacherId,
                $classId,
                $schoolId
            ),
        ]);
    }

    Response::error('Method not allowed.', 405);
} catch (\SAMS\Exceptions\RequestPayloadTooLargeException $e) {
    Response::error($e->getMessage(), $e->httpStatus());
} catch (InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[SAMS assignments] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
