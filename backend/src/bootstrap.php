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

$configPaths = [
    $backendRoot . '/config/app.php',
    $projectRoot . '/config/app.php',
];

$appConfigPath = null;
foreach ($configPaths as $candidate) {
    if (is_file($candidate)) {
        $appConfigPath = $candidate;
        break;
    }
}

$usingExampleConfig = false;
if ($appConfigPath === null && getenv('SAMS_ALLOW_EXAMPLE_CONFIG') === '1') {
    $examplePaths = [
        $backendRoot . '/config/app.example.php',
        $projectRoot . '/config/app.example.php',
    ];

    foreach ($examplePaths as $examplePath) {
        if (is_file($examplePath)) {
            $appConfigPath = $examplePath;
            $usingExampleConfig = true;
            break;
        }
    }
}

if ($appConfigPath === null) {
    throw new RuntimeException(
        'Missing application configuration. Copy backend/config/app.example.php to backend/config/app.php and configure it before starting SAMS.'
    );
}

$appConfig = require $appConfigPath;

if (!is_array($appConfig)) {
    throw new RuntimeException('Invalid application configuration.');
}

$environment = strtolower(trim((string)($appConfig['environment'] ?? '')));
if (!in_array($environment, ['development', 'test', 'production'], true)) {
    throw new RuntimeException('Invalid application environment. Use development, test, or production.');
}

$runtimeEnvironment = getenv('SAMS_ENV');
if ($runtimeEnvironment !== false && strtolower(trim($runtimeEnvironment)) !== $environment) {
    throw new RuntimeException('SAMS_ENV does not match the application configuration environment.');
}

$debug = $appConfig['debug'] ?? null;
if (!is_bool($debug)) {
    throw new RuntimeException('Invalid application debug setting. It must be boolean.');
}

if ($environment === 'production' && $debug) {
    throw new RuntimeException('Production configuration must have debug=false.');
}

if ($environment === 'production' && $usingExampleConfig) {
    throw new RuntimeException('The example application configuration cannot be used in production.');
}

$name = trim((string)($appConfig['name'] ?? ''));
if ($name === '' || mb_strlen($name) > 100) {
    throw new RuntimeException('Invalid application name.');
}

$basePath = trim((string)($appConfig['base_path'] ?? ''), '/');
if ($basePath !== '' && !preg_match('#^[A-Za-z0-9._~/-]+$#', $basePath)) {
    throw new RuntimeException('Invalid application base_path.');
}

$sessionName = (string)($appConfig['session_name'] ?? 'SAMS_SESSION');
if (!preg_match('/^[A-Za-z0-9_-]+$/', $sessionName)) {
    throw new RuntimeException('Invalid session_name.');
}

$sessionLifetime = (int)($appConfig['session_lifetime'] ?? 3600);
$idleTimeout = (int)($appConfig['session_idle_timeout'] ?? $sessionLifetime);
$absoluteTimeout = (int)($appConfig['session_absolute_timeout'] ?? 43200);
$loginMaxAttempts = (int)($appConfig['login_max_attempts'] ?? 5);
$loginLockMinutes = (int)($appConfig['login_lock_minutes'] ?? 15);

if ($sessionLifetime < 300 || $sessionLifetime > 604800) {
    throw new RuntimeException('Invalid session_lifetime.');
}
if ($idleTimeout < 300 || $idleTimeout > 604800) {
    throw new RuntimeException('Invalid session_idle_timeout.');
}
if ($absoluteTimeout < $idleTimeout || $absoluteTimeout > 2592000) {
    throw new RuntimeException('Invalid session_absolute_timeout.');
}
if ($loginMaxAttempts < 1 || $loginMaxAttempts > 100) {
    throw new RuntimeException('Invalid login_max_attempts.');
}
if ($loginLockMinutes < 1 || $loginLockMinutes > 1440) {
    throw new RuntimeException('Invalid login_lock_minutes.');
}

$appConfig['name'] = $name;
$appConfig['environment'] = $environment;
$appConfig['debug'] = $debug;
$appConfig['base_path'] = $basePath === '' ? '' : '/' . $basePath;
$appConfig['session_name'] = $sessionName;
$appConfig['session_lifetime'] = $sessionLifetime;
$appConfig['session_idle_timeout'] = $idleTimeout;
$appConfig['session_absolute_timeout'] = $absoluteTimeout;
$appConfig['login_max_attempts'] = $loginMaxAttempts;
$appConfig['login_lock_minutes'] = $loginLockMinutes;
$appConfig['_using_example_config'] = $usingExampleConfig;

$GLOBALS['appConfig'] = $appConfig;

if (!function_exists('sams_json_body')) {
    function sams_json_body(): array
    {
        $contentLength = (string)($_SERVER['CONTENT_LENGTH'] ?? '');
        $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
        if (
            ctype_digit($contentLength)
            && (int)$contentLength > \SAMS\Http\Request::MAX_JSON_BODY_SIZE
            && !str_starts_with($contentType, 'multipart/form-data')
        ) {
            throw new \SAMS\Exceptions\RequestPayloadTooLargeException('Request payload is too large.');
        }

        $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
        if (str_starts_with($contentType, 'multipart/form-data')) {
            return [];
        }

        $stream = fopen('php://input', 'rb');
        if ($stream === false) {
            throw new \InvalidArgumentException('Unable to read request payload.');
        }

        $raw = stream_get_contents($stream, \SAMS\Http\Request::MAX_JSON_BODY_SIZE + 1);
        fclose($stream);

        if ($raw === false) {
            throw new \InvalidArgumentException('Unable to read request payload.');
        }

        if (strlen($raw) > \SAMS\Http\Request::MAX_JSON_BODY_SIZE) {
            throw new \SAMS\Exceptions\RequestPayloadTooLargeException('Request payload is too large.');
        }

        if (trim($raw) === '') {
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