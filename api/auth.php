<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Response;
use SAMS\Repositories\UserRepository;
use SAMS\Services\AuthService;

try {
    $action = (string)($_GET['action'] ?? '');
    $method = sams_method();

    if ($action === 'session' && $method === 'GET') {
        Response::success([
            'authenticated' => Auth::check(),
            'user' => Auth::user(),
            'csrf' => Csrf::token(),
        ]);
    }

    if ($action === 'logout' && $method === 'POST') {
        Auth::requireLogin();
        if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) Response::error('Invalid CSRF token.', 419);
        Auth::logout();
        Response::success();
    }

    if ($action !== 'login' || $method !== 'POST') Response::error('Unsupported authentication request.', 405);

    $body = sams_json_body();
    $token = (string)($body['csrf'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!Csrf::verify($token)) Response::error('Invalid CSRF token.', 419);

    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');
    if ($username === '' || mb_strlen($username) > 50 || $password === '') Response::error('Invalid credentials.', 422);

    $config = $GLOBALS['appConfig'] ?? [];
    $lockMinutes = max(1, (int)($config['login_lock_minutes'] ?? 5));

    $service = new AuthService(new UserRepository());
    try {
        $user = $service->authenticate($username, $password, $lockMinutes);
    } catch (RuntimeException $e) {
        $status = str_contains($e->getMessage(), 'temporarily locked') ? 429 : 401;
        Response::error('Invalid credentials.', $status);
    }

    Auth::login($user);
    Response::success(['user' => Auth::user(), 'csrf' => Csrf::token()]);
} catch (Throwable $e) {
    error_log('[SAMS auth] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
