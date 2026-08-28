<?php

declare(strict_types=1);

namespace SAMS\Helpers;

final class Security
{
    public static function startSession(string $name = 'SAMS_SESSION', int $lifetime = 3600): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) return;
        $lifetime = max(300, $lifetime);
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.cookie_httponly', '1');
        ini_set('session.cookie_samesite', 'Lax');
        ini_set('session.gc_maxlifetime', (string)$lifetime);
        session_name($name);
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => self::isHttps(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        if (!session_start()) throw new \RuntimeException('Unable to start the application session.');
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
