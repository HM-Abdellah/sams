<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Response;
use SAMS\Repositories\AcademicYearRepository;
use SAMS\Services\AcademicYearAdministrationService;

try {
    $user = Auth::requireLogin();
    if (!in_array((string)$user['role'], ['admin', 'counselor'], true)) {
        Response::error('Forbidden.', 403);
    }

    $repo = new AcademicYearRepository();
    $adminService = new AcademicYearAdministrationService();
    $method = sams_method();

    if ($method === 'GET') {
        Response::success(['academic_years' => $repo->all()]);
    }

    Auth::requireRole('admin');

    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }

    $body = sams_json_body();
    $action = (string)($body['action'] ?? '');

    if ($action === 'create') {
        $id = $adminService->create(
            (int)$user['id'],
            (string)($body['name'] ?? ''),
            (string)($body['starts_on'] ?? ''),
            (string)($body['ends_on'] ?? ''),
            !empty($body['activate'])
        );

        Response::success(['id' => $id], 201);
    }

    if ($action === 'activate') {
        $id = (int)($body['id'] ?? 0);
        $adminService->activate((int)$user['id'], $id);
        Response::success(['id' => $id]);
    }

    Response::error('Unknown action.', 400);
} catch (\SAMS\Exceptions\AdministrationException $e) {
    Response::error($e->getMessage(), $e->httpStatus());
} catch (\SAMS\Exceptions\RequestPayloadTooLargeException $e) {
    Response::error($e->getMessage(), $e->httpStatus());
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable $e) {
    error_log('[SAMS academic years] ' . $e->getMessage());
    Response::error('Server error.', 500);
}