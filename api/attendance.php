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
    if ($method === 'POST' && (string)($body['action'] ?? '') === 'bulk') {
        $entries = $body['entries'] ?? null;

        if (!is_array($entries) || $entries === [] || count($entries) > 500) {
            Response::error('Invalid attendance batch.', 422);
        }

        $class = $classes->find($classId);
        if ($class === null) {
            Response::error('Class not found.', 404);
        }

        $academicYear = (new AcademicYearRepository())->find((int)$class['academic_year_id']);
        if ($academicYear === null) {
            Response::error('Academic year not found.', 422);
        }

        // Load the class roster once instead of issuing one student query per entry.
        $students = $studentRepo->forClass($classId);
        $allowedStudents = [];
        foreach ($students as $rosterStudent) {
            if ((string)$rosterStudent['status'] === 'active') {
                $allowedStudents[(int)$rosterStudent['id']] = true;
            }
        }

        $normalized = [];
        $seen = [];
        $minDate = null;
        $maxDate = null;

        foreach ($entries as $index => $entry) {
            if (!is_array($entry)) {
                Response::error('Invalid attendance batch entry.', 422, ['index' => $index]);
            }

            $entryStudentId = (int)($entry['student_id'] ?? 0);
            $entryDate = (string)($entry['attendance_date'] ?? '');
            $entryPeriod = (int)($entry['period'] ?? 0);
            $entryAction = (string)($entry['action'] ?? 'upsert');

            if (!isset($allowedStudents[$entryStudentId])) {
                Response::error('Student not found.', 404, ['index' => $index]);
            }

            $service->validateKey($entryStudentId, $entryDate, $entryPeriod);

            if (
                $entryDate < (string)$academicYear['starts_on']
                || $entryDate > (string)$academicYear['ends_on']
            ) {
                Response::error(
                    'Attendance date is outside the academic year.',
                    422,
                    ['index' => $index]
                );
            }

            $key = $entryStudentId . ':' . $entryDate . ':' . $entryPeriod;
            if (isset($seen[$key])) {
                Response::error(
                    'Duplicate attendance entry in batch.',
                    422,
                    ['index' => $index, 'key' => $key]
                );
            }
            $seen[$key] = true;

            $status = null;
            if ($entryAction !== 'delete') {
                $status = (string)($entry['status'] ?? '');
                $service->validate($entryStudentId, $entryDate, $entryPeriod, $status);
            } elseif (!in_array($entryAction, ['delete'], true)) {
                Response::error('Invalid attendance action.', 422, ['index' => $index]);
            }

            $minDate = $minDate === null || $entryDate < $minDate ? $entryDate : $minDate;
            $maxDate = $maxDate === null || $entryDate > $maxDate ? $entryDate : $maxDate;

            $normalized[] = [
                'student_id' => $entryStudentId,
                'attendance_date' => $entryDate,
                'period' => $entryPeriod,
                'action' => $entryAction,
                'status' => $status,
            ];
        }

        $existingRows = $repo->forClassRange($classId, $minDate, $maxDate);
        $existing = [];
        foreach ($existingRows as $row) {
            $key = (int)$row['student_id'] . ':' . $row['attendance_date'] . ':' . (int)$row['period'];
            $existing[$key] = $row;
        }

        $pdo = Database::connection();
        $audit = new AuditLogRepository();
        $pdo->beginTransaction();

        try {
            $changed = 0;
            $unchanged = 0;

            foreach ($normalized as $entry) {
                $key = $entry['student_id'] . ':' . $entry['attendance_date'] . ':' . $entry['period'];
                $previous = $existing[$key] ?? null;

                if ($entry['action'] === 'delete') {
                    if ($previous === null) {
                        ++$unchanged;
                        continue;
                    }

                    $repo->delete(
                        $entry['student_id'],
                        $entry['attendance_date'],
                        $entry['period']
                    );

                    $audit->record(
                        (int)$user['id'],
                        'attendance.delete',
                        'attendance',
                        (int)$previous['id'],
                        [
                            'class_id' => $classId,
                            'student_id' => $entry['student_id'],
                            'attendance_date' => $entry['attendance_date'],
                            'period' => $entry['period'],
                            'previous_status' => $previous['status'],
                            'batch' => true,
                        ]
                    );

                    ++$changed;
                    continue;
                }

                if ($previous !== null && (string)$previous['status'] === $entry['status']) {
                    ++$unchanged;
                    continue;
                }

                $repo->upsert(
                    $entry['student_id'],
                    $entry['attendance_date'],
                    $entry['period'],
                    $entry['status'],
                    (int)$user['id']
                );

                $audit->record(
                    (int)$user['id'],
                    'attendance.upsert',
                    'attendance',
                    $previous ? (int)$previous['id'] : null,
                    [
                        'class_id' => $classId,
                        'student_id' => $entry['student_id'],
                        'attendance_date' => $entry['attendance_date'],
                        'period' => $entry['period'],
                        'previous_status' => $previous['status'] ?? null,
                        'status' => $entry['status'],
                        'batch' => true,
                    ]
                );

                ++$changed;
            }

            $pdo->commit();

            Response::success([
                'changed' => $changed,
                'unchanged' => $unchanged,
                'total' => count($normalized),
            ]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

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
