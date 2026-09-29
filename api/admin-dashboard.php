<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Response;
use SAMS\Repositories\AdminDashboardRepository;

try {
    $admin = Auth::requireRole('admin');
    if (sams_method() !== 'GET') Response::error('Method not allowed.', 405);

    $repo = new AdminDashboardRepository();
    Response::success([
        'date' => date('Y-m-d'),
        'absence_alert_threshold' => AdminDashboardRepository::ABSENCE_ALERT_THRESHOLD,
        'summary' => $repo->summary((int)$admin['school_id']),
        'class_stats' => $repo->classStats((int)$admin['school_id']),
        'attention_students' => $repo->attentionStudents((int)$admin['school_id']),
        'classes_without_today_records' => $repo->classesWithoutTodayRecords((int)$admin['school_id']),
        'recent_audit' => $repo->recentAudit((int)$admin['school_id']),
    ]);
} catch (InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[SAMS admin dashboard] ' . $e->getMessage());
    Response::error('Server error.', 500);
}