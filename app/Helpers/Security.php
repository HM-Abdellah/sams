<?php

declare(strict_types=1);

namespace SAMS\Helpers;

final class Security
{
    private const SESSION_STARTED_AT = '_sams_session_started_at';
    private const SESSION_LAST_ACTIVITY = '_sams_session_last_activity';

    public static function startSession(string $name = 'SAMS_SESSION', int $lifetime = 3600): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) return;

        $lifetime = max(300, $lifetime);
        $secure = self::isHttps();

        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_trans_sid', '0');
        ini_set('session.cookie_httponly', '1');
        ini_set('session.cookie_samesite', 'Lax');
        ini_set('session.cookie_secure', $secure ? '1' : '0');
        ini_set('session.gc_maxlifetime', (string)$lifetime);

        session_name($name);
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);

        if (!session_start()) {
            throw new \RuntimeException('Unable to start the application session.');
        }

        $now = time();
        $_SESSION[self::SESSION_STARTED_AT] = isset($_SESSION[self::SESSION_STARTED_AT])
            && is_int($_SESSION[self::SESSION_STARTED_AT])
            ? $_SESSION[self::SESSION_STARTED_AT]
            : $now;
        $_SESSION[self::SESSION_LAST_ACTIVITY] = isset($_SESSION[self::SESSION_LAST_ACTIVITY])
            && is_int($_SESSION[self::SESSION_LAST_ACTIVITY])
            ? $_SESSION[self::SESSION_LAST_ACTIVITY]
            : $now;
    }

    /**
     * Enforce application-level idle and absolute session limits.
     * Returns false when the session state has been expired and replaced.
     */
    public static function touchSession(int $idleLifetime, int $absoluteLifetime): bool
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            throw new \RuntimeException('Session is not active.');
        }

        $idleLifetime = max(300, $idleLifetime);
        $absoluteLifetime = max($idleLifetime, $absoluteLifetime);
        $now = time();

        $startedAt = isset($_SESSION[self::SESSION_STARTED_AT])
            && is_int($_SESSION[self::SESSION_STARTED_AT])
            ? $_SESSION[self::SESSION_STARTED_AT]
            : $now;

        $lastActivity = isset($_SESSION[self::SESSION_LAST_ACTIVITY])
            && is_int($_SESSION[self::SESSION_LAST_ACTIVITY])
            ? $_SESSION[self::SESSION_LAST_ACTIVITY]
            : $now;

        if (($now - $lastActivity) >= $idleLifetime || ($now - $startedAt) >= $absoluteLifetime) {
            self::clearSessionState();
            return false;
        }

        $_SESSION[self::SESSION_LAST_ACTIVITY] = $now;
        return true;
    }

    /** Clear application state while keeping a fresh, active PHP session. */
    public static function clearSessionState(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) return;

        $_SESSION = [];
        session_regenerate_id(true);
        $now = time();
        $_SESSION[self::SESSION_STARTED_AT] = $now;
        $_SESSION[self::SESSION_LAST_ACTIVITY] = $now;
    }

    public static function regenerateSessionId(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) throw new \RuntimeException('Session is not active.');
        session_regenerate_id(true);
    }

    public static function hashPassword(string $password): string
    {
        if ($password === '') throw new \InvalidArgumentException('Password cannot be empty.');
        $hash = password_hash($password, PASSWORD_DEFAULT);
        if ($hash === false) throw new \RuntimeException('Password hashing failed.');
        return $hash;
    }

    public static function verifyPassword(string $password, string $hash): bool
    {
        return $password !== '' && $hash !== '' && password_verify($password, $hash);
    }

    public static function shouldRehashPassword(string $hash): bool
    {
        return password_needs_rehash($hash, PASSWORD_DEFAULT);
    }

    public static function equals(string $known, string $user): bool
    {
        return hash_equals($known, $user);
    }

    public static function clientIp(): string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
    }

    public static function userAgent(): string
    {
        return mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 512);
    }

    private static function isHttps(): bool
    {
        $https = strtolower((string)($_SERVER['HTTPS'] ?? ''));
        return $https === 'on' || $https === '1';
    }

    private function __construct() {}
}
