<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Helpers\Auth;
use SAMS\Helpers\Security;
use SAMS\Repositories\SyncEventRepository;
use SAMS\Http\Request;

/** Authenticated SSE feed. Only generic change notifications leave this endpoint. */
final class SyncEventsController
{
    public function __construct(
        private readonly SyncEventRepository $events = new SyncEventRepository(),
    ) {}

    public function stream(Request $request): never
    {
        Security::startSession(
            (string)($GLOBALS['appConfig']['session_name'] ?? 'SAMS_SESSION'),
            (int)($GLOBALS['appConfig']['session_lifetime'] ?? 3600)
        );
        $user = Auth::user();
        if ($user === null) {
            // HTTP 204 tells EventSource not to retry an expired session in a tight loop.
            http_response_code(204);
            header('Cache-Control: no-store');
            exit;
        }
        $schoolId = (int)($user['school_id'] ?? 0);
        if ($schoolId < 1) {
            http_response_code(204);
            header('Cache-Control: no-store');
            exit;
        }

        // An EventSource connection must not hold the PHP session lock for its lifetime.
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }

        if (function_exists('set_time_limit')) {
            @set_time_limit(30);
        }
        @ini_set('zlib.output_compression', '0');
        @ini_set('output_buffering', '0');
        ignore_user_abort(false);

        http_response_code(200);
        header('Content-Type: text/event-stream; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('X-Accel-Buffering: no');
        header('Connection: keep-alive');
        foreach (Security::responseHeaders() as $name => $value) {
            header($name . ': ' . $value);
        }

        while (ob_get_level() > 0) {
            if (!@ob_end_flush()) break;
        }
        ob_implicit_flush(true);

        $lastEventIdHeader = (string)($_SERVER['HTTP_LAST_EVENT_ID'] ?? '');
        $lastEventId = ctype_digit($lastEventIdHeader)
            ? min((int)$lastEventIdHeader, PHP_INT_MAX)
            : $this->events->latestIdForSchool($schoolId);

        $deadline = microtime(true) + 25.0;
        $lastHeartbeat = microtime(true);
        echo "retry: 500\n\n";
        flush();

        while (microtime(true) < $deadline && !connection_aborted()) {
            foreach ($this->events->after($schoolId, $lastEventId) as $event) {
                $lastEventId = (int)$event['id'];
                $eventType = (string)$event['event_type'];
                if ($eventType !== 'data.changed') continue;

                echo 'id: ' . $lastEventId . "\n";
                echo "event: data-changed\n";
                echo "data: {\"type\":\"data-changed\"}\n\n";
                flush();
                $lastHeartbeat = microtime(true);
                if (connection_aborted()) break 2;
            }

            $now = microtime(true);
            if ($now - $lastHeartbeat >= 5.0) {
                echo ": keep-alive\n\n";
                flush();
                $lastHeartbeat = $now;
            }
            usleep(500_000);
        }

        echo ": reconnect\n\n";
        flush();
        exit;
    }
}
