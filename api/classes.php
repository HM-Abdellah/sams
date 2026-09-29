<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Response;
use SAMS\Repositories\ClassRepository;
use SAMS\Services\ClassAdministrationService;

try {
    $user = Auth::requireLogin();
    $repo = new ClassRepository();
    $adminService = new ClassAdministrationService();
    $schoolId = (int)$user['school_id'];
    $method = sams_method();

    if ($method === 'GET') {
        if ((string)($_GET['scope'] ?? '') === 'all') {
            Auth::requireRole('admin');
            Response::success([
                'classes' => $repo->allForAdmin($schoolId)
            ]);
        }

        Response::success([
            'classes' => $repo->forUser((int)$user['id'], (string)$user['role'], $schoolId)
        ]);
    }

    if ($method !== 'POST') {
        Response::error('Method not allowed.', 405);
    }

    Auth::requireRole('admin');

    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }

    $body = sams_json_body();
    $action = (string)($body['action'] ?? 'create');

    if ($action === 'create') {
        $id = $adminService->create(
            (int)$user['id'],
            (string)($body['name'] ?? ''),
            isset($body['level']) ? (string)$body['level'] : null,
            isset($body['branch']) ? (string)$body['branch'] : null,
            $schoolId
        );

        Response::success(['id' => $id], 201);
    }

    if ($action === 'update') {
        $classId = (int)($body['id'] ?? 0);
        $id = $adminService->update(
            (int)$user['id'],
            $classId,
            array_key_exists('name', $body) ? (string)$body['name'] : null,
            array_key_exists('level', $body) ? (string)$body['level'] : null,
            array_key_exists('branch', $body) ? (string)$body['branch'] : null,
            $schoolId
        );

        Response::success(['id' => $id]);
    }

    if ($action === 'deactivate' || $action === 'activate') {
        $classId = (int)($body['id'] ?? 0);
        $changed = $adminService->setActive(
            (int)$user['id'],
            $classId,
            $action === 'activate',
            $schoolId
        );

        Response::success(['changed' => $changed]);
    }

    Response::error('Unknown action.', 400);
} catch (\SAMS\Exceptions\AdministrationException $e) {
    Response::error($e->getMessage(), $e->httpStatus());
} catch (\SAMS\Exceptions\RequestPayloadTooLargeException $e) {
    Response::error($e->getMessage(), $e->httpStatus());
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable $e) {
    error_log('[SAMS classes] ' . $e->getMessage());
    Response::error('Server error.', 500);
}