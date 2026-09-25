<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMSHelpersAuth;
use SAMSHelpersResponse;
use SAMSRepositoriesArchiveRepository;
use SAMSRepositoriesClassRepository;
use SAMSServicesReportService;

try {
    $user = Auth::requireLogin();

    if (sams_method() !== 'GET') {
        Response::error('Method not allowed.', 405);
    }

    $classId = (int)($_GET['class_id'] ?? 0);
    $view = (string)($_GET['view'] ?? 'days');

    if ($classId < 1) {
        Response::error('Invalid class.', 422);
    }

    if (!in_array($view, ['days', 'month', 'day', 'student'], true)) {
        Response::error('Invalid archive view.', 422);
    }

    $classes = new ClassRepository();
    if (!$classes->hasHistoricalAccess((int)$user['id'], (string)$user['role'], $classId)) {
        Response::error('Forbidden.', 403);
    }

    $archive = new ArchiveRepository();
    $class = $archive->classInfo($classId);
    if ($class === null) {
        Response::error('Class not found.', 404);
    }

    if ($view === 'student') {
        $studentId = (int)($_GET['student_id'] ?? 0);
        if ($studentId < 1) {
            Response::error('Invalid student.', 422);
        }

        if (!$archive->studentInClass($studentId, $classId)) {
            Response::error('Student history not found for this class.', 404);
        }

        Response::success([
            'view' => 'student',
            'class' => $class,
            'student_id' => $studentId,
            'history' => $archive->studentHistory($studentId, $classId),
        ]);
    }

    if ($view === 'day') {
        $date = (string)($_GET['date'] ?? '');
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);

        if (!$parsed || $parsed->format('Y-m-d') !== $date) {
            Response::error('Invalid archive date.', 422);
        }

        if (
            $date < (string)$class['academic_year_starts_on']
            || $date > (string)$class['academic_year_ends_on']
        ) {
            Response::error('Archive date is outside the class academic year.', 422);
        }

        Response::success([
            'view' => 'day',
            'class' => $class,
            'date' => $date,
            'records' => $archive->daily($classId, $date),
        ]);
    }

    $month = (string)($_GET['month'] ?? '');
    if ($month === '') {
        $month = (string)substr((string)$class['academic_year_starts_on'], 0, 7);
    }

    [$start, $end] = (new ReportService())->monthRange($month);

    if (
        $end < (string)$class['academic_year_starts_on']
        || $start > (string)$class['academic_year_ends_on']
    ) {
        Response::error('Archive month is outside the class academic year.', 422);
    }

    if ($view === 'month') {
        Response::success([
            'view' => 'month',
            'class' => $class,
            'month' => $month,
            'start' => $start,
            'end' => $end,
            'students' => $archive->monthlyStudents($classId, $start, $end),
        ]);
    }

    Response::success([
        'view' => 'days',
        'class' => $class,
        'month' => $month,
        'start' => $start,
        'end' => $end,
        'days' => $archive->days($classId, $start, $end),
    ]);
} catch (Throwable $e) {
    error_log('[SAMS archive] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
