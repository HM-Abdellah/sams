<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use PDOException;
use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Database;
use SAMS\Helpers\Response;
use SAMS\Helpers\Security;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\UserRepository;
use SAMS\Services\UserService;
use Throwable;

try {
    $admin = Auth::requireRole('admin');
    $repo = new UserRepository();
    $audit = new AuditLogRepository();
    $method = sams_method();

    if ($method === 'GET') {
        Response::success(['users' => $repo->forAdmin()]);
    }

    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }

    $body = sams_json_body();
    $action = (string)($body['action'] ?? '');
    $service = new UserService();

    if ($action === 'create') {
        $username = $service->validateUsername((string)($body['username'] ?? ''));
        $fullName = $service->validateFullName((string)($body['full_name'] ?? ''));
        $role = $service->validateRole((string)($body['role'] ?? ''));
        $password = $service->validatePassword((string)($body['password'] ?? ''));

        try {
            $id = $repo->create(
                $username,
                $fullName,
                Security::hashPassword($password),
                $role
            );
        } catch (PDOException $e) {
            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                Response::error('Username already exists.', 409);
            }
            throw $e;
        }

        $audit->record(
            (int)$admin['id'],
            'user.create',
            'user',
            $id,
            ['role' => $role]
        );

        Response::success(['id' => $id], 201);
    }

    if ($action === 'update') {
        $userId = (int)($body['id'] ?? 0);
        if ($userId < 1) Response::error('Invalid user.', 422);

        $existing = $repo->findById($userId);
        if ($existing === null) Response::error('User not found.', 404);

        $fullName = $service->validateFullName((string)($body['full_name'] ?? $existing['full_name']));
        $role = $service->validateRole((string)($body['role'] ?? $existing['role']));
        $isActive = array_key_exists('is_active', $body)
            ? (bool)$body['is_active']
            : (bool)$existing['is_active'];

        $removingAdminAccess = (string)$existing['role'] === 'admin'
            && (string)$role !== 'admin';
        $deactivatingAdmin = (string)$existing['role'] === 'admin' && !$isActive;

        if ($userId === (int)$admin['id'] && !$isActive) {
            Response::error('You cannot deactivate your own account.', 409);
        }

        if ($removingAdminAccess || $deactivatingAdmin) {
            if ($repo->countActiveAdmins() <= 1) {
                Response::error('The system must keep at least one active administrator.', 409);
            }
        }

        $repo->updateProfile($userId, $fullName, $role, $isActive);

        $audit->record(
            (int)$admin['id'],
            'user.update',
            'user',
            $userId,
            [
                'role' => $role,
                'is_active' => $isActive,
            ]
        );

        Response::success(['id' => $userId]);
    }

    if ($action === 'reset_password') {
        $userId = (int)($body['id'] ?? 0);
        if ($userId < 1) Response::error('Invalid user.', 422);
        if ($repo->findById($userId) === null) Response::error('User not found.', 404);

        $password = $service->validatePassword((string)($body['password'] ?? ''));
        $repo->updatePasswordHash($userId, Security::hashPassword($password));

        $audit->record(
            (int)$admin['id'],
            'user.password_reset',
            'user',
            $userId
        );

        Response::success();
    }

    Response::error('Unknown action.', 400);
} catch (Throwable $e) {
    error_log('[SAMS users] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
