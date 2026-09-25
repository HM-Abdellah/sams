<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use InvalidArgumentException;
use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Database;
use SAMS\Helpers\Response;
use SAMS\Repositories\AttendanceRepository;
use SAMS\Repositories\AcademicYearRepository;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\ClassRepository;
use SAMS\Repositories\StudentRepository;
use SAMS\Services\AttendanceService;
use Throwable;

try {
    $user = Auth::requireLogin();
    $classId = (int)($_GET['class_id'] ?? 0);
    if ($classId < 1) Response::error('Invalid class.', 422);

    $classes = new ClassRepository();
    if (!$classes->hasAccess((int)$user['id'], (string)$user['role'], $classId)) {
        Response::error('Forbidden.', 403);
    }

    $method = sams_method();
    $repo = new AttendanceRepository();

    if ($method === 'GET') {
        $month = (string)($_GET['month'] ?? '');
        if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
            Response::error('Invalid month.', 422);
        }

        Response::success(['attendance' => $repo->forClassMonth($classId, $month)]);
    }

    if (!in_array((string)$user['role'], ['admin', 'teacher'], true)) {
        Response::error('Forbidden.', 403);
    }

    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }

    $body = sams_json_body();
    $studentId = (int)($body['student_id'] ?? 0);
    $date = (string)($body['attendance_date'] ?? '');
    $period = (int)($body['period'] ?? 0);
    $action = (string)($body['action'] ?? 'upsert');

    $class = $classes->find($classId);
    if ($class === null) {
        Response::error('Class not found.', 404);
    }

    $academicYear = (new AcademicYearRepository())->find((int)$class['academic_year_id']);
    if ($academicYear === null) {
        Response::error('Academic year not found.', 422);
    }

    $studentRepo = new StudentRepository();
    $student = $studentRepo->findInClass($studentId, $classId);
    if (!$student || (string)$student['status'] !== 'active') {
        Response::error('Student not found.', 404);
    }

    $service = new AttendanceService();
    $service->validateKey($studentId, $date, $period);

    if ($date < (string)$academicYear['starts_on'] || $date > (string)$academicYear['ends_on']) {
        Response::error('Attendance date is outside the academic year.', 422);
    }

    $pdo = Database::connection();
    $audit = new AuditLogRepository();
    $pdo->beginTransaction();

    try {
        $existing = $repo->find($studentId, $date, $period);

        if ($action === 'delete' || $method === 'DELETE') {
            if ($existing !== null) {
                $repo->delete($studentId, $date, $period);
                $audit->record(
                    (int)$user['id'],
                    'attendance.delete',
                    'attendance',
                    (int)$existing['id'],
                    [
                        'class_id' => $classId,
                        'student_id' => $studentId,
                        'attendance_date' => $date,
                        'period' => $period,
                        'previous_status' => $existing['status'],
                    ]
                );
            }

            $pdo->commit();
            Response::success(['changed' => $existing !== null]);
        }

        $status = (string)($body['status'] ?? '');
        $service->validate($studentId, $date, $period, $status);

        // Avoid generating audit noise for an exact no-op.
        if ($existing !== null && (string)$existing['status'] === $status) {
            $pdo->commit();
            Response::success(['changed' => false]);
        }

        $repo->upsert($studentId, $date, $period, $status, (int)$user['id']);
        $audit->record(
            (int)$user['id'],
            'attendance.upsert',
            'attendance',
            $existing ? (int)$existing['id'] : null,
            [
                'class_id' => $classId,
                'student_id' => $studentId,
                'attendance_date' => $date,
                'period' => $period,
                'previous_status' => $existing['status'] ?? null,
                'status' => $status,
            ]
        );

        $pdo->commit();
        Response::success(['changed' => true]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
} catch (InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[SAMS attendance] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
