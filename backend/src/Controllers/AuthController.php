<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use RuntimeException;
use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Security;
use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Services\AuthService;

final class AuthController
{
    public function validateLogin(array $input): array
    {
        $identifier = trim((string)($input['identifier'] ?? $input['sams_code'] ?? $input['username'] ?? ''));
        $password = (string)($input['password'] ?? '');

        if ($identifier === '' || mb_strlen($identifier) > 50) {
            throw new \InvalidArgumentException('Invalid credentials.');
        }
        if ($password === '') {
            throw new \InvalidArgumentException('Password is required.');
        }

        return ['identifier' => $identifier, 'password' => $password];
    }

    public function __invoke(Request $request, array $params = []): Response
    {
        Security::startSession(
            (string)($GLOBALS['appConfig']['session_name'] ?? 'SAMS_SESSION'),
            (int)($GLOBALS['appConfig']['session_lifetime'] ?? 3600)
        );

        $action = (string)($params['action'] ?? '');

        if ($action === 'session' && $request->method() === 'GET') {
            $user = Auth::user();

            return Response::json([
                'success' => true,
                'data' => [
                    'authenticated' => $user !== null,
                    'user' => $user,
                    'csrf' => Csrf::token(),
                ],
            ]);
        }

        if ($action === 'logout' && $request->method() === 'POST') {
            $user = Auth::requireLogin();
            $csrfError = $this->requireCsrf($request);
            if ($csrfError !== null) return $csrfError;

            try {
                (new AuditLogRepository())->record(
                    (int)$user['id'],
                    'auth.logout',
                    'user',
                    (int)$user['id']
                );
            } catch (\Throwable $e) {
                error_log('[SAMS audit] ' . $e->getMessage());
            }

            Auth::logout();

            return Response::json([
                'success' => true,
                'data' => null,
            ]);
        }

        if ($action !== 'login' || $request->method() !== 'POST') {
            return Response::json([
                'success' => false,
                'error' => 'Unsupported authentication request.',
            ], 405);
        }

        $csrfError = $this->requireCsrf($request);
        if ($csrfError !== null) return $csrfError;

        $body = $request->jsonBody();
        $input = $this->validateLogin($body);

        $config = $GLOBALS['appConfig'] ?? [];
        $lockMinutes = max(1, (int)($config['login_lock_minutes'] ?? 15));
        $maxAttempts = max(1, (int)($config['login_max_attempts'] ?? 5));

        try {
            $service = new AuthService();
            $identifier = $input['identifier'];

            // Admin accounts use their username. Teacher/counselor accounts use
            // the fixed SAMS Code issued by the server. The backend decides which
            // authentication path applies; the browser never chooses a role.
            $user = preg_match('/^[ATC][0-9]{6}$/i', $identifier) === 1
                ? $service->authenticateBySamsCode(
                    $identifier,
                    $input['password'],
                    $lockMinutes,
                    $maxAttempts
                )
                : $service->authenticate(
                    $identifier,
                    $input['password'],
                    $lockMinutes,
                    $maxAttempts
                );
        } catch (RuntimeException $e) {
            $message = $e->getMessage();
            $isAuthenticationFailure = $message === 'Invalid credentials.'
                || $message === 'Account temporarily locked.';

            if (!$isAuthenticationFailure) {
                error_log('[SAMS auth] ' . $message);

                return Response::json([
                    'success' => false,
                    'error' => 'Authentication service temporarily unavailable.',
                ], 503);
            }

            $status = $message === 'Account temporarily locked.' ? 429 : 401;

            try {
                (new AuditLogRepository())->record(
                    null,
                    'auth.login_failed',
                    null,
                    null,
                    ['reason' => 'authentication_failed']
                );
            } catch (\Throwable $auditError) {
                error_log('[SAMS audit] ' . $auditError->getMessage());
            }

            return Response::json([
                'success' => false,
                'error' => 'Invalid credentials.',
            ], $status);
        }

        Auth::login($user);

        try {
            (new AuditLogRepository())->record(
                (int)$user['id'],
                'auth.login',
                'user',
                (int)$user['id']
            );
        } catch (\Throwable $auditError) {
            error_log('[SAMS audit] ' . $auditError->getMessage());
        }

        return Response::json([
            'success' => true,
            'data' => [
                'user' => Auth::user(),
                'csrf' => Csrf::token(),
            ],
        ]);
    }

    private function requireCsrf(Request $request): ?Response
    {
        if (!Csrf::verify($request->header('x-csrf-token'))) {
            return Response::json([
                'success' => false,
                'error' => 'Invalid CSRF token.',
            ], 419);
        }

        return null;
    }
}

