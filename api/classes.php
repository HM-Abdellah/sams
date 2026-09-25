<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Database;
use SAMS\Helpers\Response;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\ClassRepository;
use SAMS\Services\ClassService;

try {
    $user = Auth::requireLogin();
    $repo = new ClassRepository();
    $audit = new AuditLogRepository();
    $method = sams_method();

    if ($method === 'GET') {
        Response::success([
            'classes' => $repo->forUser((int)$user['id'], (string)$user['role'])
        ]);
    }

    if ($method !== 'POST') {
        Response::error('Method not allowed.', 405);
    }

    Auth::requireRole('admin');

    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }

    $body = sams_json_body();
    $action = (string)($body['action'] ?? 'create');
    $service = new ClassService();
    $pdo = Database::connection();

    if ($action === 'create') {
        $name = $service->normalizeName((string)($body['name'] ?? ''));
        $level = $service->optionalText(
            isset($body['level']) ? (string)$body['level'] : null,
            50
        );
        $branch = $service->optionalText(
            isset($body['branch']) ? (string)$body['branch'] : null,
            100
        );

        $yearId = (int)$pdo->query(
            'SELECT id FROM academic_years
             WHERE is_active = 1
             ORDER BY id DESC
             LIMIT 1'
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
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();

            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                Response::error(
                    'A class with this name already exists for the active academic year.',
                    409
                );
            }

            throw $e;
        }

        Response::success(['id' => $id], 201);
    }

    if ($action === 'update') {
        $classId = (int)($body['id'] ?? 0);
        if ($classId < 1) Response::error('Invalid class.', 422);

        $existing = $repo->find($classId);
        if ($existing === null) Response::error('Class not found.', 404);

        $name = $service->normalizeName(
            isset($body['name']) ? (string)$body['name'] : (string)$existing['name']
        );
        $level = $service->optionalText(
            isset($body['level']) ? (string)$body['level'] : (string)($existing['level'] ?? ''),
            50
        );
        $branch = $service->optionalText(
            isset($body['branch']) ? (string)$body['branch'] : (string)($existing['branch'] ?? ''),
            100
        );

        $pdo->beginTransaction();
        try {
            $repo->update($classId, $name, $level, $branch);
            $audit->record(
                (int)$user['id'],
                'class.update',
                'class',
                $classId
            );
            $pdo->commit();
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();

            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                Response::error(
                    'A class with this name already exists for the academic year.',
                    409
                );
            }

            throw $e;
        }

        Response::success(['id' => $classId]);
    }

    if ($action === 'deactivate' || $action === 'activate') {
        $classId = (int)($body['id'] ?? 0);
        if ($classId < 1) Response::error('Invalid class.', 422);

        $existing = $repo->find($classId);
        if ($existing === null) Response::error('Class not found.', 404);

        $active = $action === 'activate';
        if ((bool)$existing['is_active'] === $active) {
            Response::success(['changed' => false]);
        }

        $repo->setActive($classId, $active);
        $audit->record(
            (int)$admin['id'],
            $active ? 'class.activate' : 'class.deactivate',
            'class',
            $classId
        );

        Response::success(['changed' => true]);
    }

    Response::error('Unknown action.', 400);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable $e) {
    error_log('[SAMS classes] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
