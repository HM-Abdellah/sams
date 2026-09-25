<?php

declare(strict_types=1);

/**
 * SAMS application bootstrap.
 * Loads configuration, starts the hardened session, and loads application
 * classes in one predictable place. Public pages and API endpoints include
 * this file instead of maintaining fragile require chains.
 */

$root = dirname(__DIR__);

$appConfigPath = $root . '/config/app.php';
if (!is_file($appConfigPath)) {
    $appConfigPath = $root . '/config/app.example.php';
}

$appConfig = require $appConfigPath;

require_once $root . '/app/Helpers/Response.php';
require_once $root . '/app/Helpers/Security.php';
require_once $root . '/app/Helpers/Database.php';
require_once $root . '/app/Helpers/Csrf.php';
require_once $root . '/app/Helpers/Validation.php';
require_once $root . '/app/Helpers/Auth.php';

\SAMS\Helpers\Security::startSession(
    (string)($appConfig['session_name'] ?? 'SAMS_SESSION'),
    (int)($appConfig['session_lifetime'] ?? 3600)
);

foreach (glob($root . '/app/Repositories/*.php') ?: [] as $file) require_once $file;
foreach (glob($root . '/app/Services/*.php') ?: [] as $file) require_once $file;
foreach (glob($root . '/app/Controllers/*.php') ?: [] as $file) require_once $file;

/** Return a validated JSON object request body. */
function sams_json_body(): array
{
    $raw = file_get_contents('php://input');

    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }

    try {
        $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (\JsonException $e) {
        throw new \InvalidArgumentException('Invalid JSON payload.', 0, $e);
    }

    if (!is_array($data) || array_is_list($data)) {
        throw new \InvalidArgumentException('Invalid JSON payload.');
    }

    return $data;
}

/** Return the request method in uppercase. */
function sams_method(): string
{
    return strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
}
