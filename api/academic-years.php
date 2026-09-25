<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use PDOException;
use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Database;
use SAMS\Helpers\Response;
use SAMS\Repositories\AcademicYearRepository;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Services\AcademicYearService;
use Throwable;

try {
    $user = Auth::requireLogin();
    if (!in_array((string)$user['role'], ['admin', 'counselor'], true)) {
        Response::error('Forbidden.', 403);
    }

    $repo = new AcademicYearRepository();
    $method = sams_method();

    if ($method === 'GET') {
        Response::success(['academic_years' => $repo->all()]);
    }

    Auth::requireRole('admin');

    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }

    $body = sams_json_body();
    $action = (string)($body['action'] ?? '');
    $audit = new AuditLogRepository();
    $service = new AcademicYearService();
    $pdo = Database::connection();

    if ($action === 'create') {
        $name = $service->validateName((string)($body['name'] ?? ''));
        [$startsOn, $endsOn] = $service->validateRange(
            (string)($body['starts_on'] ?? ''),
            (string)($body['ends_on'] ?? '')
        );

        $pdo->beginTransaction();
        try {
            $id = $repo->create($name, $startsOn, $endsOn);

            if (!empty($body['activate'])) {
                $repo->deactivateAll();
                $repo->activate($id);
            }

            $audit->record(
                (int)$user['id'],
                'academic_year.create',
                'academic_year',
                $id,
                ['activate' => !empty($body['activate'])]
            );
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();

            if ($e instanceof PDOException && (int)($e->errorInfo[1] ?? 0) === 1062) {
                Response::error('Academic year already exists.', 409);
            }

            throw $e;
        }

        Response::success(['id' => $id], 201);
    }

    if ($action === 'activate') {
        $id = (int)($body['id'] ?? 0);
        if ($id < 1) Response::error('Invalid academic year.', 422);
        if ($repo->find($id) === null) Response::error('Academic year not found.', 404);

        $pdo->beginTransaction();
        try {
            // The UPDATE locks the current active rows, serializing competing
            // activations without requiring a database-specific partial index.
            $repo->deactivateAll();
            $repo->activate($id);

            $audit->record(
                (int)$user['id'],
                'academic_year.activate',
                'academic_year',
                $id
            );
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        Response::success(['id' => $id]);
    }

    Response::error('Unknown action.', 400);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable $e) {
    error_log('[SAMS academic years] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
