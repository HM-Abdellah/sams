<?php

declare(strict_types=1);

/**
 * Compatibility bridge for the legacy /api/*.php entry points.
 *
 * The application source now lives under backend/src. This file remains until
 * the legacy HTTP surface has been migrated to /api/v1 and verified.
 */

if (!defined('SAMS_LEGACY_RUNTIME')) {
    define('SAMS_LEGACY_RUNTIME', true);
}

require_once dirname(__DIR__) . '/backend/src/bootstrap.php';
