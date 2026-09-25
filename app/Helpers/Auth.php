<?php

declare(strict_types=1);

namespace SAMS\Helpers;

use SAMS\Repositories\UserRepository;

final class Auth
{
    private const SESSION_USER = '_auth_user';
    private const ROLES = ['admin', 'teacher', 'counselor'];

    public static function login(array $user): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            throw new \RuntimeException('Session must be active before login.');
        }

        $id = (int)($user['id'] ?? 0);
        $role = (string)($user['role'] ?? '');
        $name = trim((string)($user['full_name'] ?? ''));

        if ($id < 1 || !in_array($role, self::ROLES, true) || $name === '') {
            throw new \InvalidArgumentException('Invalid user identity.');
        }

        // Reset pre-auth session state, rotate the session ID, and reset the
        // application session clock before attaching the authenticated identity.
        Security::clearSessionState();
        $_SESSION[self::SESSION_USER] = [
            'id' => $id,
            'session_version' => $sessionVersion,
        ];
        Csrf::rotate();
    }

    public static function logout(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) return;

        $_SESSION = [];
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 3600,
            'path' => $params['path'] ?? '/',
            'domain' => $params['domain'] ?? '',
            'secure' => (bool)($params['secure'] ?? false),
            'httponly' => true,
            'samesite' => $params['samesite'] ?? 'Lax',
        ]);
        session_destroy();
    }

    public static function user(): ?array
    {
        if (session_status() !== PHP_SESSION_ACTIVE) return null;

        $config = $GLOBALS['appConfig'] ?? [];
        $idle = (int)($config['session_idle_timeout'] ?? $config['session_lifetime'] ?? 3600);
        $absolute = (int)($config['session_absolute_timeout'] ?? 43200);

        if (!Security::touchSession($idle, $absolute)) {
            return null;
        }

        $sessionUser = $_SESSION[self::SESSION_USER] ?? null;
        if (!is_array($sessionUser)) return null;

        $id = $sessionUser['id'] ?? null;
        $sessionVersion = $sessionUser['session_version'] ?? null;

        if (
            (!is_int($id) && !ctype_digit((string)$id))
            || (!is_int($sessionVersion) && !ctype_digit((string)$sessionVersion))
        ) {
            Security::clearSessionState();
            return null;
        }

        $user = (new UserRepository())->findActiveById((int)$id);
        if (
            $user === null
            || (int)($user['session_version'] ?? 0) !== (int)$sessionVersion
        ) {
            Security::clearSessionState();
            return null;
        }

        return [
            'id' => (int)$user['id'],
            'full_name' => (string)$user['full_name'],
            'role' => (string)$user['role'],
        ];
    }

    public static function id(): ?int
    {
        $user = self::user();
        return $user === null ? null : (int)$user['id'];
    }

    public static function check(): bool
    {
        return self::user() !== null;
    }

    public static function requireLogin(): array
    {
        $user = self::user();
        if ($user === null) Response::error('Authentication required.', 401);
        return $user;
    }

    public static function requireRole(string ...$roles): array
    {
        $user = self::requireLogin();
        if (!in_array($user['role'], $roles, true)) Response::error('Forbidden.', 403);
        return $user;
    }

    private function __construct() {}
}
