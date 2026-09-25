<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Response;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\ClassRepository;
use SAMS\Repositories\SignatureRepository;
use SAMS\Services\SignatureService;
use Throwable;

try {
    $user = Auth::requireLogin();
    $classId = (int)($_GET['class_id'] ?? 0);

    if ($classId < 1) Response::error('Invalid class.', 422);

    $classes = new ClassRepository();
    if (!$classes->hasAccess((int)$user['id'], (string)$user['role'], $classId)) {
        Response::error('Forbidden.', 403);
    }

    $repo = new SignatureRepository();
    $audit = new AuditLogRepository();
    $method = sams_method();

    if ($method === 'GET') {
        Response::success([
            'signature' => $repo->findByTeacherAndClass((int)$user['id'], $classId)
        ]);
    }

    Auth::requireRole('admin', 'teacher');

    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }

    $pdo = SAMS\Helpers\Database::connection();
    $pdo->beginTransaction();

    try {
        if ($method === 'DELETE') {
            $existing = $repo->findByTeacherAndClass((int)$user['id'], $classId);
            $repo->delete((int)$user['id'], $classId);

            if ($existing !== null) {
                $audit->record(
                    (int)$user['id'],
                    'signature.delete',
                    'signature',
                    (int)$existing['id'],
                    ['class_id' => $classId]
                );
            }

            $pdo->commit();
            Response::success(['changed' => $existing !== null]);
        }

        if ($method !== 'POST') {
            $pdo->rollBack();
            Response::error('Method not allowed.', 405);
        }

        $body = sams_json_body();
        $data = (new SignatureService())->validatePngDataUrl(
            (string)($body['signature_data'] ?? '')
        );

        $existing = $repo->findByTeacherAndClass((int)$user['id'], $classId);
        $repo->upsert((int)$user['id'], $classId, $data);

        $audit->record(
            (int)$user['id'],
            'signature.upsert',
            'signature',
            $existing ? (int)$existing['id'] : null,
            ['class_id' => $classId]
        );

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    Response::success();
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[SAMS signatures] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
