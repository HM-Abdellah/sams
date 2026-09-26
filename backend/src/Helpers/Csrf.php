<?php

declare(strict_types=1);

namespace SAMS\Helpers;

final class Csrf
{
    private const SESSION_KEY = '_csrf_token';

    /** Return the current session token, creating it once per session. */
    public static function token(): string
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            throw new \RuntimeException('Session must be active before generating a CSRF token.');
        }

        if (!isset($_SESSION[self::SESSION_KEY]) || !is_string($_SESSION[self::SESSION_KEY])) {
            $_SESSION[self::SESSION_KEY] = bin2hex(random_bytes(32));
        }

        return $_SESSION[self::SESSION_KEY];
    }

    /** Validate a supplied token using a constant-time comparison. */
    public static function verify(?string $token): bool
    {
        if (!is_string($token) || $token === '') {
            return false;
        }

        $expected = $_SESSION[self::SESSION_KEY] ?? null;
        return is_string($expected) && hash_equals($expected, $token);
    }

    /** Rotate the token after sensitive authentication state changes. */
    public static function rotate(): string
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            throw new \RuntimeException('Session must be active before rotating a CSRF token.');
        }

        $_SESSION[self::SESSION_KEY] = bin2hex(random_bytes(32));
        return $_SESSION[self::SESSION_KEY];
    }
}
