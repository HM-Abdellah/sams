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
    $user = Auth::requireLogin();

    if (sams_method() !== 'POST') {
        Response::error('Method not allowed.', 405);
    }

    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }

    $body = sams_json_body();
    $action = (string)($body['action'] ?? '');

    if ($action !== 'change_password') {
        Response::error('Unknown action.', 400);
    }

    $currentPassword = (string)($body['current_password'] ?? '');
    $newPassword = (string)($body['new_password'] ?? '');

    if ($currentPassword === '') {
        Response::error('Current password is required.', 422);
    }

    $service = new UserService();
    $service->validatePassword($newPassword);

    $users = new UserRepository();
    $securityUser = $users->findSecurityById((int)$user['id']);

    if ($securityUser === null) {
        Response::error('Account is no longer active.', 401);
    }

    if (!Security::verifyPassword($currentPassword, (string)$securityUser['password_hash'])) {
        Response::error('Current password is incorrect.', 401);
    }

    if (Security::verifyPassword($newPassword, (string)$securityUser['password_hash'])) {
        Response::error('New password must be different.', 422);
    }

    $pdo = Database::connection();
    $audit = new AuditLogRepository();

    $pdo->beginTransaction();
    try {
        $users->updatePasswordHash(
            (int)$user['id'],
            Security::hashPassword($newPassword)
        );

        $audit->record(
            (int)$user['id'],
            'account.password_change',
            'user',
            (int)$user['id']
        );

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    // updatePasswordHash increments session_version, intentionally invalidating
    // the old session so the account must authenticate again with the new secret.
    Auth::logout();

    Response::success([
        'reauthenticate' => true,
    ]);
} catch (InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[SAMS account] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
