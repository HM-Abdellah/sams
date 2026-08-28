<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Response;
use SAMS\Helpers\Database;
use SAMS\Repositories\ClassRepository;
use SAMS\Services\ReportService;

try {
    $user = Auth::requireLogin();
    if (sams_method() !== 'GET') Response::error('Method not allowed.', 405);
    $classId = (int)($_GET['class_id'] ?? 0);
    $month = (string)($_GET['month'] ?? '');
    if ($classId < 1 || !preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) Response::error('Invalid report parameters.', 422);

    $classes = new ClassRepository();
    if (!$classes->hasAccess((int)$user['id'], (string)$user['role'], $classId)) Response::error('Forbidden.', 403);
    $class = $classes->find($classId);
    [$start, $end] = (new ReportService())->monthRange($month);
    $pdo = Database::connection();
    $stmt = $pdo->prepare(
        'SELECT s.id, s.student_number, s.first_name, s.last_name,
                COALESCE(SUM(a.status = \'present\'),0) AS present_count,
                COALESCE(SUM(a.status = \'absent\'),0) AS absent_count,
                COALESCE(SUM(a.status IN (\'late\',\'excused\')),0) AS other_count,
                COUNT(a.id) AS recorded_count
         FROM students s
         LEFT JOIN attendance a ON a.student_id = s.id AND a.attendance_date BETWEEN ? AND ?
         WHERE s.class_id = ? AND s.status = \'active\'
         GROUP BY s.id, s.student_number, s.first_name, s.last_name
         ORDER BY s.last_name, s.first_name, s.id'
    );
    $stmt->execute([$start, $end, $classId]);
    Response::success(['class'=>$class,'month'=>$month,'start'=>$start,'end'=>$end,'students'=>$stmt->fetchAll()]);
} catch (Throwable $e) {
    error_log('[SAMS reports] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
