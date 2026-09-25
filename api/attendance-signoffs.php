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
                'submission' => $signoffs->findSubmission($classId, $weekStart),
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
            'submission' => $signoffs->findSubmission($classId, $weekStart),
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

    if (!in_array($action, ['sign_period', 'reopen_period', 'sign_week', 'receive_week'], true)) {
        Response::error('Unknown attendance sign-off action.', 422);
    }

    $isTeacher = (string)$user['role'] === 'teacher';
    if (in_array($action, ['sign_period', 'sign_week'], true) && !$isTeacher) {
        Response::error('Only teachers can sign attendance.', 403);
    }
    if ($action === 'receive_week' && (string)$user['role'] !== 'admin') {
        Response::error('Only administrators can receive the weekly register.', 403);
    }

    $signatureRepo = new SignatureRepository();
    $signature = $signatureRepo->findByTeacherAndClass((int)$user['id'], $classId);
    if (in_array($action, ['sign_period', 'sign_week'], true) && $signature === null) {
        Response::error('Save your class signature before signing attendance.', 422);
    }

    if (in_array($action, ['sign_period', 'reopen_period'], true)) {
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
    } else {
        if ($weekEnd < (string)$class['academic_year_starts_on'] || $weekStart > (string)$class['academic_year_ends_on']) {
            Response::error('Attendance week is outside the academic year.', 422);
        }
        $weekStart = max($weekStart, (string)$class['academic_year_starts_on']);
        $weekEnd = min($weekEnd, (string)$class['academic_year_ends_on']);
    }

    $existingPeriod = null;
    $existingWeekSignature = null;
    $weekCounts = null;
    $submission = null;

    if ($action === 'sign_period') {
        $existingPeriod = $signoffs->findPeriod($classId, $date, $period);
        if ($existingPeriod !== null && (int)$existingPeriod['teacher_id'] !== (int)$user['id']) {
            Response::error('This lesson is already signed by another teacher.', 409);
        }
    } elseif ($action === 'reopen_period') {
        $existingPeriod = $signoffs->findPeriod($classId, $date, $period);
        if ($existingPeriod === null) {
            Response::success(['changed' => false]);
        }
        if ($isTeacher && (int)$existingPeriod['teacher_id'] !== (int)$user['id']) {
            Response::error('Only the signing teacher can reopen this lesson.', 403);
        }
    } elseif ($action === 'sign_week') {
        $existingWeekSignature = $signoffs->findWeekSignature($classId, (int)$user['id'], $weekStart);
        $weekCounts = $signoffs->countTeacherPeriodSignoffs($classId, (int)$user['id'], $weekStart, $weekEnd);
        if ((int)$weekCounts['signed_lessons'] < 1) {
            Response::error('Sign at least one lesson before signing the week.', 422);
        }
        if ((int)$weekCounts['needs_resign'] > 0) {
            Response::error('Correct and re-sign all changed lessons before signing the week.', 422);
        }
    } elseif ($action === 'receive_week') {
        $teachers = $signoffs->teachersForClass($classId);
        $weeklyRows = $signoffs->weekSignatures($classId, $weekStart);
        $weeklyByTeacher = [];
        foreach ($weeklyRows as $row) {
            $weeklyByTeacher[(int)$row['teacher_id']] = $row;
        }
        if ($teachers === [] || count($weeklyByTeacher) < count($teachers)) {
            Response::error('All assigned teachers must sign the week before administration can receive it.', 422);
        }
        foreach ($teachers as $teacher) {
            $row = $weeklyByTeacher[(int)$teacher['id']] ?? null;
            if ($row === null || (string)$row['status'] !== 'signed') {
                Response::error('All assigned teachers must sign the week before administration can receive it.', 422);
            }
        }
        $submission = $signoffs->findSubmission($classId, $weekStart);
    }

    $pdo = Database::connection();
    $audit = new AuditLogRepository();
    $pdo->beginTransaction();

    try {
        if ($action === 'sign_period') {
            $signoffs->upsertPeriod($classId, (int)$user['id'], $date, $period, (string)$signature['signature_data']);
            $audit->record(
                (int)$user['id'],
                'attendance.sign_period',
                'attendance_signoff',
                $existingPeriod ? (int)$existingPeriod['id'] : null,
                ['class_id' => $classId, 'attendance_date' => $date, 'period' => $period]
            );
            $pdo->commit();
            Response::success(['signed' => true]);
        }

        if ($action === 'reopen_period') {
            $changed = $signoffs->reopenPeriod($classId, $date, $period, (int)$user['id']);
            $invalidatedSignatures = $signoffs->invalidateWeekSignature($classId, $weekStart, (int)$user['id']);
            $clearedSubmission = $signoffs->clearSubmission($classId, $weekStart);
            $audit->record(
                (int)$user['id'],
                'attendance.reopen_period',
                'attendance_signoff',
                (int)$existingPeriod['id'],
                [
                    'class_id' => $classId,
                    'attendance_date' => $date,
                    'period' => $period,
                    'invalidated_week_signatures' => $invalidatedSignatures,
                    'cleared_week_submission' => $clearedSubmission !== null,
                ]
            );
            $pdo->commit();
            Response::success(['changed' => $changed]);
        }

        if ($action === 'sign_week') {
            $signoffs->upsertWeekSignature($classId, (int)$user['id'], $weekStart, (string)$signature['signature_data']);
            $audit->record(
                (int)$user['id'],
                'attendance.sign_week',
                'attendance_week_signature',
                $existingWeekSignature ? (int)$existingWeekSignature['id'] : null,
                ['class_id' => $classId, 'week_start' => $weekStart]
            );
            $pdo->commit();
            Response::success(['signed' => true]);
        }

        if ($action === 'receive_week') {
            $signoffs->receiveWeek($classId, $weekStart, (int)$user['id']);
            $audit->record(
                (int)$user['id'],
                'attendance.receive_week',
                'attendance_week_submission',
                $submission ? (int)$submission['id'] : null,
                ['class_id' => $classId, 'week_start' => $weekStart]
            );
            $pdo->commit();
            Response::success(['received' => true]);
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
