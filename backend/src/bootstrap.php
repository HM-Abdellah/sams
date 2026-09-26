<?php

declare(strict_types=1);

/**
 * Backend bootstrap.
 *
 * Composer provides the primary PSR-4 autoloader. A tiny fallback keeps the
 * application runnable on ordinary PHP hosting before Composer is available.
 */

$backendRoot = dirname(__DIR__);
$projectRoot = dirname($backendRoot);

$composerAutoload = $backendRoot . '/vendor/autoload.php';

if (is_file($composerAutoload)) {
    require_once $composerAutoload;
} else {
    spl_autoload_register(static function (string $class): void {
        $prefix = 'SAMS\\';

        if (!str_starts_with($class, $prefix)) {
            return;
        }

        $relative = str_replace('\\', DIRECTORY_SEPARATOR, substr($class, strlen($prefix)));
        $file = __DIR__ . DIRECTORY_SEPARATOR . $relative . '.php';

        if (is_file($file)) {
            require_once $file;
        }
    });
}

$appConfigPath = $backendRoot . '/config/app.php';

if (!is_file($appConfigPath)) {
    $appConfigPath = $projectRoot . '/config/app.php';
}

if (!is_file($appConfigPath)) {
    $appConfigPath = $backendRoot . '/config/app.example.php';
}

if (!is_file($appConfigPath)) {
    throw new RuntimeException('Missing application configuration.');
}

$appConfig = require $appConfigPath;

if (!is_array($appConfig)) {
    throw new RuntimeException('Invalid application configuration.');
}

$GLOBALS['appConfig'] = $appConfig;

if (!function_exists('sams_json_body')) {
    function sams_json_body(): array
    {
        $raw = file_get_contents('php://input');

        if (!is_string($raw) || trim($raw) === '') {
            return [];
        }

        try {
            $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new InvalidArgumentException('Invalid JSON payload.', 0, $e);
        }

        if (!is_array($data) || array_is_list($data)) {
            throw new InvalidArgumentException('Invalid JSON payload.');
        }

        return $data;
    }
}

if (!function_exists('sams_method')) {
    function sams_method(): string
    {
        return strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    }
}

/*
 * Legacy /api/*.php entry points still need the hardened session lifecycle.
 * The new /api/v1 front controller opts into sessions only when an
 * authentication middleware is introduced.
 */
if (defined('SAMS_LEGACY_RUNTIME') && SAMS_LEGACY_RUNTIME) {
    \SAMS\Helpers\Security::startSession(
        (string)($appConfig['session_name'] ?? 'SAMS_SESSION'),
        (int)($appConfig['session_lifetime'] ?? 3600)
    );
}
