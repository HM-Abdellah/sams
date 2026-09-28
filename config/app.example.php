<?php

declare(strict_types=1);

/** Local/development configuration template. The backend will only use this file when SAMS_ALLOW_EXAMPLE_CONFIG=1 is explicitly set. */

return [
    'name' => 'SAMS',
    'environment' => 'development',
    'debug' => true,
    'base_path' => '/sams/public',

    // Authentication/session policy.
    'session_name' => 'SAMS_SESSION',
    'session_lifetime' => 3600,
    'session_idle_timeout' => 3600,
    'session_absolute_timeout' => 43200,
    'login_max_attempts' => 5,
    'login_lock_minutes' => 15,
];
