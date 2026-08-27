<?php

declare(strict_types=1);

namespace SAMS\Helpers;

final class Security
{
    /**
     * Start a hardened PHP session once.
     *
     * HttpOnly prevents JavaScript from reading the session cookie.
     * SameSite=Lax provides a useful CSRF defense layer in addition to the
     * explicit CSRF token used for state-changing requests.
     */
    public static function startSession(string $name, int $lifetime): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        if ($lifetime < 300) {
            $lifetime = 300;
        }

        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.cookie_httponly', '1');
        ini_set('session.cookie_samesite', 'Lax');
        ini_set('session.gc_maxlifetime', (string) $lifetime);

        session_name($name);
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => !self::isLocalHttpRequest(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);

        if (!session_start()) {
            throw new \RuntimeException('Unable to start the application session.');
        }
    }

    public static function regenerateSessionId(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            throw new \RuntimeException('Session must be active before regeneration.');
        }

        session_regenerate_id(true);
    }

    public static function hashPassword(string $password): string
    {
        if ($password === '') {
            throw new \InvalidArgumentException('Password cannot be empty.');
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        if ($hash === false) {
            throw new \RuntimeException('Password hashing failed.');
        }

        return $hash;
    }

    public static function verifyPassword(string $password, string $hash): bool
    {
        if ($password === '' || $hash === '') {
            return false;
        }

        return password_verify($password, $hash);
    }

    public static function shouldRehashPassword(string $hash): bool
    {
        return password_needs_rehash($hash, PASSWORD_DEFAULT);
    }

    /** Constant-time comparison helper for tokens and opaque secrets. */
    public static function equals(string $known, string $user): bool
    {
        return hash_equals($known, $user);
    }

    private static function isLocalHttpRequest(): bool
    {
        $https = $_SERVER['HTTPS'] ?? '';
        $forwardedProto = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
        return $https === '' || $https === 'off' || $forwardedProto === 'http';
    }

    private function __construct()
    {
    }
}
