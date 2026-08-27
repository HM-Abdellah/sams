<?php

declare(strict_types=1);

namespace SAMS\Helpers;

final class Auth
{
    private const SESSION_USER = '_auth_user';

    /** Store the minimum identity data needed by the authenticated session. */
    public static function login(array $user): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            throw new \RuntimeException('Session must be active before login.');
        }

        $id = $user['id'] ?? null;
        $role = $user['role'] ?? null;
        $fullName = $user['full_name'] ?? null;

        if (!is_int($id) && !ctype_digit((string) $id)) {
            throw new \InvalidArgumentException('Invalid authenticated user id.');
        }
        if (!is_string($role) || !in_array($role, ['admin', 'teacher', 'counselor'], true)) {
            throw new \InvalidArgumentException('Invalid authenticated user role.');
        }
        if (!is_string($fullName) || $fullName === '') {
            throw new \InvalidArgumentException('Invalid authenticated user name.');
        }

        Security::regenerateSessionId();
        $_SESSION[self::SESSION_USER] = [
            'id' => (int) $id,
            'full_name' => $fullName,
            'role' => $role,
        ];
        Csrf::rotate();
    }

    public static function logout(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return;
        }

        $_SESSION = [];

        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'] ?? '/',
            'domain' => $params['domain'] ?? '',
            'secure' => (bool) ($params['secure'] ?? false),
            'httponly' => (bool) ($params['httponly'] ?? true),
            'samesite' => $params['samesite'] ?? 'Lax',
        ]);

        session_destroy();
    }

    public static function user(): ?array
    {
        $user = $_SESSION[self::SESSION_USER] ?? null;
        return is_array($user) ? $user : null;
    }

    public static function id(): ?int
    {
        $id = self::user()['id'] ?? null;
        return is_int($id) ? $id : null;
    }

    public static function check(): bool
    {
        return self::user() !== null;
    }

    public static function requireLogin(): array
    {
        $user = self::user();
        if ($user === null) {
            Response::error('Authentication required.', 401);
        }
        return $user;
    }

    public static function requireRole(string ...$allowedRoles): array
    {
        $user = self::requireLogin();
        if (!in_array($user['role'], $allowedRoles, true)) {
            Response::error('You do not have permission to perform this action.', 403);
        }
        return $user;
    }
}
