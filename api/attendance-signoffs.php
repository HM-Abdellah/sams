<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Database;
use SAMS\Helpers\Response;
use SAMS\Repositories\AttendanceSignoffRepository;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\ClassRepository;
use SAMS\Repositories\SignatureRepository;
use SAMS\Services\ReportService;

try {
    $user = Auth::requireLogin();
    $classId = (int)($_GET['class_id'] ?? 0);
    if ($classId < 1) Response::error('Invalid class.', 422);

    $classes = new ClassRepository();
    if (!$classes->hasAccess((int)$user['id'], (string)$user['role'], $classId)) {
        Response::error('Forbidden.', 403);
    }

    $signoffs = new AttendanceSignoffRepository();
    $class = $classes->find($classId);
    if ($class === null) Response::error('Class not found.', 404);

    $method = sams_method();

    if ($method === 'GET') {
        $weekInput = (string)($_GET['week_start'] ?? '');
        [$weekStart, $weekEnd] = (new ReportService())->weekRange($weekInput);
        if (
            $weekEnd < (string)$class['academic_year_starts_on']
            || $weekStart > (string)$class['academic_year_ends_on']
        ) {
            Response::success([
                'week_start' => $weekStart,
                'week_end' => $weekEnd,
                'teachers' => $signoffs->teachersForClass($classId),
                'period_signoffs' => [],
                'weekly_signatures' => [],
            ]);
        }

        $weekStart = max($weekStart, (string)$class['academic_year_starts_on']);
        $weekEnd = min($weekEnd, (string)$class['academic_year_ends_on']);

        Response::success([
            'week_start' => $weekStart,
            'week_end' => $weekEnd,
            'teachers' => $signoffs->teachersForClass($classId),
            'period_signoffs' => $signoffs->forWeek($classId, $weekStart, $weekEnd),
            'weekly_signatures' => $signoffs->weekSignatures($classId, $weekStart),
        ]);
    }

    Auth::requireRole('admin', 'teacher');

    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }

    $body = sams_json_body();
    $action = (string)($body['action'] ?? '');

    [$weekStart, $weekEnd] = (new ReportService())->weekRange((string)($body['week_start'] ?? ''));
    $date = (string)($body['attendance_date'] ?? '');
    $period = (int)($body['period'] ?? 0);

    if (!in_array($action, ['sign_period', 'reopen_period', 'sign_week'], true)) {
        Response::error('Unknown attendance sign-off action.', 422);
    }

    $isTeacher = (string)$user['role'] === 'teacher';
    if ($action !== 'reopen_period' && !$isTeacher) {
        Response::error('Only teachers can sign attendance.', 403);
    }

    $signatureRepo = new SignatureRepository();
    $signature = $signatureRepo->findByTeacherAndClass((int)$user['id'], $classId);
    if (($action === 'sign_period' || $action === 'sign_week') && $signature === null) {
        Response::error('Save your class signature before signing attendance.', 422);
    }

    if ($action !== 'sign_week') {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            Response::error('Invalid attendance date.', 422);
        }
        if ($period < 1 || $period > 8) {
            Response::error('Invalid period.', 422);
        }
        if ($date < (string)$class['academic_year_starts_on'] || $date > (string)$class['academic_year_ends_on']) {
            Response::error('Attendance date is outside the academic year.', 422);
        }
        $weekStart = (new ReportService())->weekRange($date)[0];
    }

    $pdo = Database::connection();
    $audit = new AuditLogRepository();
    $pdo->beginTransaction();

    try {
        if ($action === 'sign_period') {
            $existing = $signoffs->findPeriod($classId, $date, $period);
            if ($existing !== null && (int)$existing['teacher_id'] !== (int)$user['id'] && $isTeacher) {
                Response::error('This lesson is already signed by another teacher.', 409);
            }
            $signoffs->upsertPeriod($classId, (int)$user['id'], $date, $period, (string)$signature['signature_data']);
            $audit->record(
                (int)$user['id'],
                'attendance.sign_period',
                'attendance_signoff',
                $existing ? (int)$existing['id'] : null,
                ['class_id' => $classId, 'attendance_date' => $date, 'period' => $period]
            );
            $pdo->commit();
            Response::success(['signed' => true]);
        }

        if ($action === 'reopen_period') {
            $existing = $signoffs->findPeriod($classId, $date, $period);
            if ($existing === null) {
                $pdo->commit();
                Response::success(['changed' => false]);
            }
            if ($isTeacher && (int)$existing['teacher_id'] !== (int)$user['id']) {
                Response::error('Only the signing teacher can reopen this lesson.', 403);
            }
            $changed = $signoffs->reopenPeriod($classId, $date, $period, (int)$user['id']);
            $audit->record(
                (int)$user['id'],
                'attendance.reopen_period',
                'attendance_signoff',
                (int)$existing['id'],
                ['class_id' => $classId, 'attendance_date' => $date, 'period' => $period]
            );
            $pdo->commit();
            Response::success(['changed' => $changed]);
        }

        if ($action === 'sign_week') {
            $existing = $signoffs->findWeekSignature($classId, (int)$user['id'], $weekStart);
            $counts = $signoffs->countTeacherPeriodSignoffs($classId, (int)$user['id'], $weekStart, $weekEnd);
            if ((int)$counts['signed_lessons'] < 1) {
                Response::error('Sign at least one lesson before signing the week.', 422);
            }
            if ((int)$counts['needs_resign'] > 0) {
                Response::error('Correct and re-sign all changed lessons before signing the week.', 422);
            }
            $signoffs->upsertWeekSignature($classId, (int)$user['id'], $weekStart, (string)$signature['signature_data']);
            $audit->record(
                (int)$user['id'],
                'attendance.sign_week',
                'attendance_week_signature',
                $existing ? (int)$existing['id'] : null,
                ['class_id' => $classId, 'week_start' => $weekStart]
            );
            $pdo->commit();
            Response::success(['signed' => true]);
        }
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    Response::error('Invalid attendance sign-off action.', 422);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[SAMS attendance signoffs] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
