<?php

declare(strict_types=1);

require_once __DIR__ . '/../backend/src/bootstrap.php';

use SAMS\Helpers\Database;
use SAMS\Repositories\SyncEventRepository;

function sync_expect(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$pdo = Database::connection();
$pdo->exec("CREATE TABLE schools (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(150) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sync_test_school_code (code)
) ENGINE=InnoDB");

$migrationPath = __DIR__ . '/../database/migrations/012_school_realtime_sync_events.sql';
$migration = file_get_contents($migrationPath);
sync_expect($migration !== false, 'Migration 012 file could not be read.');
$migration = preg_replace('/^\s*--.*$/m', '', $migration) ?? $migration;
foreach (preg_split('/;\s*(?:\R|$)/', $migration, -1, PREG_SPLIT_NO_EMPTY) as $statement) {
    if (trim($statement) !== '') $pdo->exec($statement);
}

$columns = $pdo->query('SHOW COLUMNS FROM school_sync_events')->fetchAll(PDO::FETCH_COLUMN);
sync_expect(
    $columns === ['id', 'school_id', 'event_type', 'created_at'],
    'Migration 012 produced an unexpected event table shape.'
);

$pdo->exec("CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    school_id BIGINT UNSIGNED NOT NULL,
    username VARCHAR(50) NOT NULL,
    employee_id VARCHAR(50) NULL,
    full_name VARCHAR(120) NOT NULL,
    avatar_path VARCHAR(255) NULL,
    phone VARCHAR(30) NULL,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    role VARCHAR(20) NOT NULL,
    account_status VARCHAR(20) NOT NULL DEFAULT 'active',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    session_version INT UNSIGNED NOT NULL DEFAULT 1,
    last_seen_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sync_test_user (school_id, username)
) ENGINE=InnoDB");
$pdo->exec("INSERT INTO schools (code, name) VALUES ('SYNC-A', 'Sync School A'), ('SYNC-B', 'Sync School B')");
$schoolA = (int)$pdo->query("SELECT id FROM schools WHERE code = 'SYNC-A'")->fetchColumn();
$schoolB = (int)$pdo->query("SELECT id FROM schools WHERE code = 'SYNC-B'")->fetchColumn();
$pdo->prepare("INSERT INTO users (school_id, username, full_name, role, account_status, is_active, session_version) VALUES (?, 'sync.user', 'Sync Test User', 'admin', 'active', 1, 1)")->execute([$schoolA]);
$events = new SyncEventRepository();

$cursorA = $events->latestIdForSchool($schoolA);
$eventA = $events->publish($schoolA);
$eventB = $events->publish($schoolB);
$afterA = $events->after($schoolA, $cursorA);
sync_expect(count($afterA) === 1, 'School A received another school\'s synchronization event.');
sync_expect((int)$afterA[0]['id'] === $eventA, 'School A event cursor returned the wrong event.');
sync_expect((string)$afterA[0]['event_type'] === 'data.changed', 'Unexpected synchronization event type.');
sync_expect($events->latestIdForSchool($schoolA) === $eventA, 'School-local latest cursor is incorrect.');
sync_expect($events->after($schoolA, $eventA) === [], 'Cursor filtering returned a stale event for the same school.');
$afterB = $events->after($schoolB, $eventA);
sync_expect(count($afterB) === 1 && (int)$afterB[0]['id'] === $eventB, 'School B did not receive its own event after the shared cursor.');
sync_expect($eventB > $eventA, 'Global event IDs should increase monotonically.');
sync_expect(
    array_keys($afterA[0]) === ['id', 'event_type', 'created_at'],
    'The event payload exposes unexpected fields.'
);

// Execute a real child request lifecycle so the registered shutdown publisher is tested.
$bootstrapPath = realpath(__DIR__ . '/../backend/src/bootstrap.php');
sync_expect($bootstrapPath !== false, 'Backend bootstrap could not be resolved.');
$schoolLiteral = (string)$schoolA;
$childCode = '$_SERVER["REQUEST_METHOD"] = "POST";'
    . ' require ' . var_export($bootstrapPath, true) . ';'
    . ' \\SAMS\\Helpers\\Security::startSession((string)($GLOBALS["appConfig"]["session_name"] ?? "SAMS_SESSION"), 3600);'
    . ' $_SESSION["_auth_user"] = ["id" => 123, "school_id" => ' . $schoolLiteral . ', "session_version" => 1];'
    . ' http_response_code(201); echo "shutdown-test";';
$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$process = proc_open([PHP_BINARY, '-r', $childCode], $descriptors, $pipes, dirname(__DIR__));
sync_expect(is_resource($process), 'Could not launch shutdown-event integration subprocess.');
fclose($pipes[0]);
$childOutput = stream_get_contents($pipes[1]);
$childError = stream_get_contents($pipes[2]);
fclose($pipes[1]);
fclose($pipes[2]);
$childExitCode = proc_close($process);
sync_expect($childExitCode === 0, 'Shutdown publisher subprocess failed: ' . (string)$childError);
sync_expect(trim((string)$childOutput) === 'shutdown-test', 'Shutdown publisher subprocess output was unexpected.');

$shutdownEvents = $events->after($schoolA, $eventA);
sync_expect(count($shutdownEvents) === 1, 'A successful authenticated write did not publish a sync event on shutdown.');
sync_expect((string)$shutdownEvents[0]['event_type'] === 'data.changed', 'Shutdown publisher emitted the wrong event type.');

// Exercise the actual SSE controller in a child process against this disposable DB.
$controllerCode = '$_SERVER["REQUEST_METHOD"] = "GET";'
    . ' $_SERVER["HTTP_LAST_EVENT_ID"] = "0";'
    . ' require ' . var_export($bootstrapPath, true) . ';'
    . ' \SAMS\Helpers\Security::startSession((string)($GLOBALS["appConfig"]["session_name"] ?? "SAMS_SESSION"), 3600);'
    . ' $_SESSION["_auth_user"] = ["id" => 1, "school_id" => ' . $schoolLiteral . ', "session_version" => 1];'
    . ' (new \SAMS\Controllers\SyncEventsController())->stream(new \SAMS\Http\Request("GET", "/events"));';
$streamDescriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$streamProcess = proc_open([PHP_BINARY, '-r', $controllerCode], $streamDescriptors, $streamPipes, dirname(__DIR__));
sync_expect(is_resource($streamProcess), 'Could not launch authenticated SSE integration subprocess.');
fclose($streamPipes[0]);
stream_set_blocking($streamPipes[1], false);
stream_set_blocking($streamPipes[2], false);
$streamOutput = '';
$streamError = '';
$streamDeadline = microtime(true) + 4.0;
while (microtime(true) < $streamDeadline && !str_contains($streamOutput, 'event: data-changed')) {
    $chunk = fread($streamPipes[1], 8192);
    if (is_string($chunk) && $chunk !== '') $streamOutput .= $chunk;
    $errorChunk = fread($streamPipes[2], 8192);
    if (is_string($errorChunk) && $errorChunk !== '') $streamError .= $errorChunk;
    usleep(25_000);
}
if (!str_contains($streamOutput, 'event: data-changed')) {
    proc_terminate($streamProcess);
}
$tail = stream_get_contents($streamPipes[1]);
if (is_string($tail)) $streamOutput .= $tail;
$tailError = stream_get_contents($streamPipes[2]);
if (is_string($tailError)) $streamError .= $tailError;
fclose($streamPipes[1]);
fclose($streamPipes[2]);
$streamExitCode = proc_close($streamProcess);
sync_expect(
    str_contains($streamOutput, 'event: data-changed') && str_contains($streamOutput, '"type":"data-changed"'),
    'Authenticated SSE controller did not stream a generic change event. Output: ' . $streamOutput . ' Error: ' . $streamError . ' Exit: ' . $streamExitCode
);
sync_expect(!str_contains($streamOutput, 'SYNC-A') && !str_contains($streamOutput, 'Sync Test User'), 'The SSE stream exposed school or account details.');
sync_expect(str_contains($streamOutput, 'id: ' . $eventA), 'SSE did not preserve the event cursor.');

// Logout destroys the session, so it must explicitly publish before clearing identity.
$logoutCursor = $events->latestIdForSchool($schoolA);
$logoutCode = 'require ' . var_export($bootstrapPath, true) . ';'
    . ' \SAMS\Helpers\Security::startSession((string)($GLOBALS["appConfig"]["session_name"] ?? "SAMS_SESSION"), 3600);'
    . ' $_SESSION["_auth_user"] = ["id" => 1, "school_id" => ' . $schoolLiteral . ', "session_version" => 1];'
    . ' \SAMS\Helpers\Auth::logout();';
$logoutProcess = proc_open([PHP_BINARY, '-r', $logoutCode], $descriptors, $logoutPipes, dirname(__DIR__));
sync_expect(is_resource($logoutProcess), 'Could not launch logout-event integration subprocess.');
fclose($logoutPipes[0]);
$logoutOutput = stream_get_contents($logoutPipes[1]);
$logoutError = stream_get_contents($logoutPipes[2]);
fclose($logoutPipes[1]);
fclose($logoutPipes[2]);
$logoutExitCode = proc_close($logoutProcess);
sync_expect($logoutExitCode === 0, 'Logout-event publisher subprocess failed: ' . (string)$logoutError);
sync_expect(trim((string)$logoutOutput) === '', 'Logout subprocess should not emit an application payload.');
$logoutEvents = $events->after($schoolA, $logoutCursor);
sync_expect(count($logoutEvents) === 1, 'Logout did not publish a school-scoped change event.');

echo "[PASS] migration 012, school isolation, cursor handling, write/logout publishing, and authenticated SSE streaming" . PHP_EOL;
