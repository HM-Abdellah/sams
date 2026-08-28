<?php

declare(strict_types=1);

namespace SAMS\Helpers;

final class Auth
{
    private const SESSION_USER = '_auth_user';
    private const ROLES = ['admin', 'teacher', 'counselor'];

    public static function login(array $user): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) throw new \RuntimeException('Session must be active before login.');
        $id = (int)($user['id'] ?? 0);
        $role = (string)($user['role'] ?? '');
        $name = trim((string)($user['full_name'] ?? ''));
        if ($id < 1 || !in_array($role, self::ROLES, true) || $name === '') throw new \InvalidArgumentException('Invalid user identity.');
        Security::regenerateSessionId();
        $_SESSION[self::SESSION_USER] = ['id' => $id, 'full_name' => $name, 'role' => $role];
        Csrf::rotate();
    }

    public static function logout(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) return;
        $_SESSION = [];
        $params = session_get_cookie_params();
        setcookie(session_name(), '', ['expires'=>time()-3600,'path'=>$params['path'] ?? '/','domain'=>$params['domain'] ?? '','secure'=>(bool)($params['secure'] ?? false),'httponly'=>true,'samesite'=>$params['samesite'] ?? 'Lax']);
        session_destroy();
    }

    public static function user(): ?array
    {
        $user = $_SESSION[self::SESSION_USER] ?? null;
        return is_array($user) && isset($user['id'], $user['role']) ? $user : null;
    }

    public static function id(): ?int
    {
        $id = self::user()['id'] ?? null;
        return is_numeric($id) ? (int)$id : null;
    }

    public static function check(): bool { return self::user() !== null; }

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
