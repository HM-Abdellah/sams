<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Database;
use SAMS\Helpers\Response;
use SAMS\Helpers\Security;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\UserRepository;
use SAMS\Services\UserService;

try {
    $admin = Auth::requireRole('admin');
    $repo = new UserRepository();
    $audit = new AuditLogRepository();
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
    $service = new UserService();
    $pdo = Database::connection();

    if ($action === 'create') {
        $username = $service->validateUsername((string)($body['username'] ?? ''));
        $fullName = $service->validateFullName((string)($body['full_name'] ?? ''));
        $role = $service->validateRole((string)($body['role'] ?? ''));
        $password = $service->validatePassword((string)($body['password'] ?? ''));

        $pdo->beginTransaction();
        try {
            $id = $repo->create(
                $username,
                $fullName,
                Security::hashPassword($password),
                $role
            );

            $audit->record(
                (int)$admin['id'],
                'user.create',
                'user',
                $id,
                ['role' => $role]
            );

            $pdo->commit();
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();

            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                Response::error('Username already exists.', 409);
            }

            throw $e;
        }

        Response::success(['id' => $id], 201);
    }

    if ($action === 'update') {
        $userId = (int)($body['id'] ?? 0);
        if ($userId < 1) Response::error('Invalid user.', 422);

        $existing = $repo->findById($userId);
        if ($existing === null) Response::error('User not found.', 404);

        $fullName = $service->validateFullName(
            isset($body['full_name']) ? (string)$body['full_name'] : (string)$existing['full_name']
        );
        $role = $service->validateRole(
            isset($body['role']) ? (string)$body['role'] : (string)$existing['role']
        );
        $isActive = array_key_exists('is_active', $body)
            ? (bool)$body['is_active']
            : (bool)$existing['is_active'];

        $removingAdminAccess =
            (string)$existing['role'] === 'admin' && $role !== 'admin';
        $deactivatingAdmin =
            (string)$existing['role'] === 'admin' && !$isActive;

        if ($userId === (int)$admin['id'] && !$isActive) {
            Response::error('You cannot deactivate your own account.', 409);
        }

        if ($removingAdminAccess || $deactivatingAdmin) {
            if ($repo->countActiveAdmins() <= 1) {
                Response::error(
                    'The system must keep at least one active administrator.',
                    409
                );
            }
        }

        $pdo->beginTransaction();
        try {
            $repo->updateProfile($userId, $fullName, $role, $isActive);
            $audit->record(
                (int)$admin['id'],
                'user.update',
                'user',
                $userId,
                ['role' => $role, 'is_active' => $isActive]
            );
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        Response::success(['id' => $userId]);
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
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable $e) {
    error_log('[SAMS users] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
