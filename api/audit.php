<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Response;
use SAMS\Helpers\Validation;
use SAMS\Repositories\AuditLogRepository;
use Throwable;

try {
    Auth::requireRole('admin');

    if (sams_method() !== 'GET') {
        Response::error('Method not allowed.', 405);
    }

    $userId = null;
    if (isset($_GET['user_id']) && $_GET['user_id'] !== '') {
        $userId = Validation::id($_GET['user_id'], 'user_id');
    }

    $action = isset($_GET['action']) ? trim((string)$_GET['action']) : null;
    $entityType = isset($_GET['entity_type']) ? trim((string)$_GET['entity_type']) : null;
    $fromDate = isset($_GET['from']) ? Validation::date($_GET['from'], 'from') : null;
    $toDate = isset($_GET['to']) ? Validation::date($_GET['to'], 'to') : null;
    $page = isset($_GET['page']) ? Validation::id($_GET['page'], 'page') : 1;
    $perPage = isset($_GET['per_page']) ? Validation::id($_GET['per_page'], 'per_page') : 50;

    if ($fromDate !== null && $toDate !== null && $fromDate > $toDate) {
        Response::error('Invalid audit date range.', 422);
    }

    $result = (new AuditLogRepository())->search(
        $userId,
        $action,
        $entityType,
        $fromDate,
        $toDate,
        $page,
        $perPage
    );

    Response::success($result);
} catch (Throwable $e) {
    error_log('[SAMS audit] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
