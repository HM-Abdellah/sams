<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use PDOException;
use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Database;
use SAMS\Helpers\Response;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\ClassRepository;
use SAMS\Services\ClassService;
use Throwable;

try {
    $user = Auth::requireLogin();
    $repo = new ClassRepository();
    $audit = new AuditLogRepository();
    $method = sams_method();

    if ($method === 'GET') {
        Response::success(['classes' => $repo->forUser((int)$user['id'], (string)$user['role'])]);
    }

    if ($method !== 'POST') {
        Response::error('Method not allowed.', 405);
    }

    Auth::requireRole('admin');

    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }

    $body = sams_json_body();
    $service = new ClassService();
    $name = $service->normalizeName((string)($body['name'] ?? ''));
    $level = $service->optionalText(isset($body['level']) ? (string)$body['level'] : null, 50);
    $branch = $service->optionalText(isset($body['branch']) ? (string)$body['branch'] : null, 100);

    $pdo = Database::connection();
    $yearId = (int)$pdo->query(
        'SELECT id FROM academic_years WHERE is_active = 1 ORDER BY id DESC LIMIT 1'
    )->fetchColumn();

    if ($yearId < 1) {
        Response::error('No active academic year configured.', 422);
    }

    $pdo->beginTransaction();
    try {
        $id = $repo->create($yearId, $name, $level, $branch);
        $audit->record(
            (int)$user['id'],
            'class.create',
            'class',
            $id,
            ['academic_year_id' => $yearId]
        );
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();

        if ($e instanceof PDOException && (int)($e->errorInfo[1] ?? 0) === 1062) {
            Response::error(
                'A class with this name already exists for the active academic year.',
                409
            );
        }

        throw $e;
    }

    Response::success(['id' => $id], 201);
} catch (Throwable $e) {
    error_log('[SAMS classes] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
