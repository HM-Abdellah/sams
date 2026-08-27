<?php

declare(strict_types=1);

/** Local/development configuration template. */

return [
    'name' => 'SAMS',
    'environment' => 'development',
    'debug' => true,
    'base_path' => '/sams/public',
    'session_name' => 'SAMS_SESSION',
    'session_lifetime' => 3600,
    'login_max_attempts' => 5,
    'login_lock_minutes' => 15,
];
