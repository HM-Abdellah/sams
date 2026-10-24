<?php

declare(strict_types=1);

/**
 * Run DB-backed integration tests against a disposable database, never the live DB.
 *
 * Usage:
 *   php tests/run_isolated_database_integration.php integration
 *   php tests/run_isolated_database_integration.php school-import
 */

$config = require __DIR__ . '/../backend/config/database.php';
// Allow containerized test runners to reach the same disposable-DB server.
$hostOverride = getenv('SAMS_DB_HOST');
$portOverride = getenv('SAMS_DB_PORT');
if (is_string($hostOverride) && trim($hostOverride) !== '') {
    $config['host'] = trim($hostOverride);
}
if (is_string($portOverride) && trim($portOverride) !== '') {
    $config['port'] = (int)$portOverride;
}
$suite = (string)($argv[1] ?? '');

$suites = [
    'integration' => __DIR__ . '/integration.php',
    'school-import' => __DIR__ . '/school_import_final_integration.php',
    'tenant-isolation' => __DIR__ . '/tenant_isolation_integration.php',
    'onboarding' => __DIR__ . '/onboarding_integration.php',
    'profile-avatar' => __DIR__ . '/profile_avatar_integration.php',
    'phase39' => __DIR__ . '/phase39_data_analytics_reporting_integration.php',
    'administration' => __DIR__ . '/administration_backend_integration.php',
    'attendance' => __DIR__ . '/attendance_backend_integration.php',
    'phase6' => __DIR__ . '/phase6_archive_reports_signatures_integration.php',
    'phase7' => __DIR__ . '/phase7_security_reliability_integration.php',
    'phase38' => __DIR__ . '/phase38_attendance_concurrency_integration.php',
    'sync-events' => __DIR__ . '/sync_events_backend_integration.php',
];

if (!isset($suites[$suite])) {
    fwrite(STDERR, "Specify integration, school-import, tenant-isolation, onboarding, profile-avatar, phase39, administration, attendance, phase6, phase7, or phase38, sync-events.\n");
    exit(2);
}

$testDatabaseName = 'sams_test_' . bin2hex(random_bytes(6));
if (!preg_match('/^sams_test_[a-f0-9]{12}$/', $testDatabaseName)) {
    throw new RuntimeException('Unable to generate a safe temporary database name.');
}

$dsn = sprintf(
    'mysql:host=%s;port=%d;charset=%s',
    (string)$config['host'],
    (int)$config['port'],
    (string)($config['charset'] ?? 'utf8mb4')
);
$server = new PDO(
    $dsn,
    (string)$config['username'],
    (string)$config['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$server->exec('CREATE DATABASE ' . $testDatabaseName . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$exitCode = 0;

try {
    putenv('SAMS_TEST_DB_HOST=' . (string)$config['host']);
    putenv('SAMS_TEST_DB_PORT=' . (string)$config['port']);
    putenv('SAMS_TEST_DB_NAME=' . $testDatabaseName);
    putenv('SAMS_TEST_DB_USER=' . (string)$config['username']);
    putenv('SAMS_TEST_DB_PASS=' . (string)$config['password']);

    require $suites[$suite];
    echo "[PASS] Isolated {$suite} integration suite.\n";
} catch (Throwable $error) {
    fwrite(STDERR, '[FAIL] ' . get_class($error) . ': ' . $error->getMessage() . PHP_EOL);
    fwrite(STDERR, $error->getTraceAsString() . PHP_EOL);
    $exitCode = 1;
} finally {
    try {
        $server->exec('DROP DATABASE IF EXISTS ' . $testDatabaseName);
        echo "[CLEANUP] Disposed integration database {$testDatabaseName}.\n";
    } catch (Throwable $cleanupError) {
        fwrite(STDERR, '[CLEANUP FAILED] ' . $cleanupError->getMessage() . PHP_EOL);
        $exitCode = 1;
    }
}

exit($exitCode);
