<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Database;
use SAMS\Helpers\Response;
use SAMS\Repositories\ClassRepository;
use SAMS\Services\ReportService;

try {
    $user = Auth::requireLogin();

    if (sams_method() !== 'GET') {
        Response::error('Method not allowed.', 405);
    }

    $classId = (int)($_GET['class_id'] ?? 0);
    $month = (string)($_GET['month'] ?? '');

    if (
        $classId < 1
        || !preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)
    ) {
        Response::error('Invalid report parameters.', 422);
    }

    $classes = new ClassRepository();
    if (!$classes->hasAccess((int)$user['id'], (string)$user['role'], $classId)) {
        Response::error('Forbidden.', 403);
    }

    $class = $classes->find($classId);
    if ($class === null) {
        Response::error('Class not found.', 404);
    }

    [$start, $end] = (new ReportService())->monthRange($month);

    $stmt = Database::connection()->prepare(
        'SELECT
            s.id,
            s.student_number,
            s.massar_code,
            s.first_name,
            s.last_name,
            s.birth_date,
            COALESCE(SUM(a.status = \'present\'), 0) AS present_count,
            COALESCE(SUM(a.status = \'absent\'), 0) AS absent_count,
            COALESCE(SUM(a.status = \'late\'), 0) AS late_count,
            COALESCE(SUM(a.status = \'excused\'), 0) AS excused_count,
            COALESCE(SUM(a.status IN (\'late\', \'excused\')), 0) AS other_count,
            COUNT(a.id) AS recorded_count
         FROM student_enrollments e
         INNER JOIN students s ON s.id = e.student_id
         LEFT JOIN attendance a
            ON a.enrollment_id = e.id
           AND a.attendance_date BETWEEN ? AND ?
         WHERE e.class_id = ?
           AND e.starts_on <= ?
           AND (e.ends_on IS NULL OR e.ends_on >= ?)
         GROUP BY
            s.id,
            s.student_number,
            s.massar_code,
            s.first_name,
            s.last_name,
            s.birth_date
         ORDER BY s.last_name, s.first_name, s.id'
    );

    $stmt->execute([$start, $end, $classId, $end, $start]);

    Response::success([
        'class' => $class,
        'month' => $month,
        'start' => $start,
        'end' => $end,
        'students' => $stmt->fetchAll(),
    ]);
} catch (Throwable $e) {
    error_log('[SAMS reports] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
