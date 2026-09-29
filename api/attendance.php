<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Exceptions\AttendanceWorkflowException;
use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Response;
use SAMS\Repositories\AttendanceRepository;
use SAMS\Repositories\ClassRepository;
use SAMS\Services\ReportService;
use SAMS\Services\TeacherAttendanceService;

try {
    $user = Auth::requireLogin();
    $classId = (int)($_GET['class_id'] ?? 0);
    if ($classId < 1) Response::error('Invalid class.', 422);

    $classes = new ClassRepository();
    $schoolId = (int)$user['school_id'];
    if (!$classes->hasAccess((int)$user['id'], (string)$user['role'], $classId, $schoolId)) {
        Response::error('Forbidden.', 403);
    }

    $method = sams_method();
    $repo = new AttendanceRepository();

    if ($method === 'GET') {
        $weekStart = (string)($_GET['week_start'] ?? '');
        if ($weekStart !== '') {
            [$start, $end] = (new ReportService())->weekRange($weekStart);
            $class = $classes->find($classId, $schoolId);
            if ($class === null) Response::error('Class not found.', 404);

            if (
                $end < (string)$class['academic_year_starts_on']
                || $start > (string)$class['academic_year_ends_on']
            ) {
                Response::success([
                    'attendance' => [],
                    'week_start' => $start,
                    'week_end' => $end,
                ]);
            }

            $start = max($start, (string)$class['academic_year_starts_on']);
            $end = min($end, (string)$class['academic_year_ends_on']);

            Response::success([
                'attendance' => $repo->forClassRange($classId, $start, $end),
                'week_start' => $start,
                'week_end' => $end,
            ]);
        }

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
    $teacherAttendance = new TeacherAttendanceService();
    $action = (string)($body['action'] ?? 'upsert');

    if ($method === 'POST' && $action === 'bulk') {
        $result = $teacherAttendance->saveBulk(
            (int)$user['id'],
            (string)$user['role'],
            $classId,
            $body['entries'] ?? [],
            $schoolId
        );

        Response::success($result);
    }

    if (!in_array($method, ['POST', 'DELETE'], true)) {
        Response::error('Method not allowed.', 405);
    }

    $studentId = (int)($body['student_id'] ?? 0);
    $date = (string)($body['attendance_date'] ?? '');
    $period = (int)($body['period'] ?? 0);
    $entryAction = ($method === 'DELETE' || $action === 'delete') ? 'delete' : 'upsert';

    $result = $teacherAttendance->saveBulk(
        (int)$user['id'],
        (string)$user['role'],
        $classId,
        [[
            'student_id' => $studentId,
            'attendance_date' => $date,
            'period' => $period,
            'action' => $entryAction,
            ...(($entryAction === 'upsert') ? ['status' => (string)($body['status'] ?? '')] : []),
        ]],
        $schoolId
    );

    Response::success(['changed' => (int)($result['changed'] ?? 0) > 0]);
} catch (AttendanceWorkflowException $e) {
    Response::error($e->getMessage(), $e->httpStatus());
} catch (\SAMS\Exceptions\RequestPayloadTooLargeException $e) {
    Response::error($e->getMessage(), $e->httpStatus());
} catch (InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[SAMS attendance] ' . $e->getMessage());
    Response::error('Server error.', 500);
}