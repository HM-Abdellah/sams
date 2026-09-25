<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Response;
use SAMS\Repositories\UserRepository;

try {
    $user = Auth::requireLogin();
    if (sams_method() !== 'POST') Response::error('Method not allowed.', 405);
    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }
    (new UserRepository())->touchPresence((int)$user['id']);
    Response::success(['online' => true]);
} catch (InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[SAMS presence] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
