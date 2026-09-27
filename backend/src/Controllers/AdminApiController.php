<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Security;
use SAMS\Http\Request;
use SAMS\Http\Response;

abstract class AdminApiController
{
    protected function requireSession(): void
    {
        Security::startSession(
            (string)($GLOBALS['appConfig']['session_name'] ?? 'SAMS_SESSION'),
            (int)($GLOBALS['appConfig']['session_lifetime'] ?? 3600)
        );
    }

    protected function requireAdmin(): array
    {
        $this->requireSession();
        return Auth::requireRole('admin');
    }

    protected function requireAdminOrCounselor(): array
    {
        $this->requireSession();
        return Auth::requireRole('admin', 'counselor');
    }

    protected function requireCsrf(Request $request): ?Response
    {
        if (Csrf::verify($request->header('x-csrf-token'))) {
            return null;
        }

        return Response::json([
            'success' => false,
            'error' => 'Invalid CSRF token.',
        ], 419);
    }

    protected function error(\Throwable $e): Response
    {
        $status = $e instanceof \SAMS\Exceptions\AdministrationException
            ? $e->httpStatus()
            : ($e instanceof \InvalidArgumentException ? 422 : 500);

        if ($status >= 500) {
            error_log('[SAMS admin] ' . $e->getMessage());
        }

        return Response::json([
            'success' => false,
            'error' => $status >= 500 ? 'Server error.' : $e->getMessage(),
        ], $status);
    }
}