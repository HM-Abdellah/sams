<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Response;
use SAMS\Repositories\UserRepository;
use SAMS\Services\UserAdministrationService;

try {
    $admin = Auth::requireRole('admin');
    $repo = new UserRepository();
    $adminService = new UserAdministrationService();
    $method = sams_method();

    if ($method === 'GET') {
        Response::success(['users' => $repo->forAdmin()]);
    }

    if ($method !== 'POST') {
        Response::error('Method not allowed.', 405);
    }

    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }

    $body = sams_json_body();
    $action = (string)($body['action'] ?? '');

    if ($action === 'create') {
        $id = $adminService->create(
            (int)$admin['id'],
            (string)($body['username'] ?? ''),
            (string)($body['full_name'] ?? ''),
            (string)($body['role'] ?? ''),
            (string)($body['password'] ?? ''),
            array_key_exists('employee_id', $body) ? (string)$body['employee_id'] : null,
            array_key_exists('phone', $body) ? (string)$body['phone'] : null
        );

        Response::success(['id' => $id], 201);
    }

    if ($action === 'update') {
        $userId = (int)($body['id'] ?? 0);
        $id = $adminService->update(
            (int)$admin['id'],
            $userId,
            array_key_exists('full_name', $body) ? (string)$body['full_name'] : null,
            array_key_exists('role', $body) ? (string)$body['role'] : null,
            array_key_exists('is_active', $body) ? (bool)$body['is_active'] : null,
            array_key_exists('employee_id', $body) ? (string)$body['employee_id'] : null,
            array_key_exists('phone', $body) ? (string)$body['phone'] : null
        );

        Response::success(['id' => $id]);
    }

    if ($action === 'reset_password') {
        $userId = (int)($body['id'] ?? 0);
        if ($userId < 1) Response::error('Invalid user.', 422);
        if ($repo->findById($userId) === null) {
            Response::error('User not found.', 404);
        }

        $password = $service->validatePassword((string)($body['password'] ?? ''));

        $pdo->beginTransaction();
        try {
            $repo->updatePasswordHash(
                $userId,
                Security::hashPassword($password)
            );
            $audit->record(
                (int)$admin['id'],
                'user.password_reset',
                'user',
                $userId
            );
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        Response::success();
    }

    if ($action === 'unlock') {
        $userId = (int)($body['id'] ?? 0);
        if ($userId < 1) Response::error('Invalid user.', 422);

        $existing = $repo->findById($userId);
        if ($existing === null) Response::error('User not found.', 404);

        $pdo->beginTransaction();
        try {
            $repo->unlock($userId);
            $audit->record(
                (int)$admin['id'],
                'user.unlock',
                'user',
                $userId
            );
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        Response::success(['id' => $userId]);
    }

    Response::error('Unknown action.', 400);
} catch (\SAMS\Exceptions\AdministrationException $e) {
    Response::error($e->getMessage(), $e->httpStatus());
} catch (\SAMS\Exceptions\RequestPayloadTooLargeException $e) {
    Response::error($e->getMessage(), $e->httpStatus());
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable $e) {
    error_log('[SAMS users] ' . $e->getMessage());
    Response::error('Server error.', 500);
}