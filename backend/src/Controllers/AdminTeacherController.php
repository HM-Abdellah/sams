<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Services\TeacherAdministrationService;

final class AdminTeacherController extends AdminApiController
{
    public function __construct(
        private readonly TeacherAdministrationService $service = new TeacherAdministrationService()
    ) {}

    public function __invoke(Request $request, array $params = []): Response
    {
        $admin = $this->requireAdmin();

        if ($request->method() === 'GET') {
            try {
                return Response::json([
                    'success' => true,
                    'data' => $this->service->list(
                        isset($admin['school_id']) ? (int)$admin['school_id'] : null
                    ),
                ]);
            } catch (\Throwable $e) {
                return $this->error($e);
            }
        }

        $csrfError = $this->requireCsrf($request);
        if ($csrfError !== null) return $csrfError;

        if ($request->method() !== 'POST') {
            return Response::json([
                'success' => false,
                'error' => 'Method not allowed.',
            ], 405, ['Allow' => 'GET, POST']);
        }

        try {
            $body = $request->jsonBody();
            $action = (string)($body['action'] ?? '');

            if ($action === 'assign') {
                $id = $this->service->assignTeaching(
                    (int)$admin['id'],
                    (int)($body['teacher_id'] ?? 0),
                    (int)($body['subject_id'] ?? 0),
                    (int)($body['class_id'] ?? 0),
                    isset($admin['school_id']) ? (int)$admin['school_id'] : null
                );

                return Response::json([
                    'success' => true,
                    'data' => ['id' => $id],
                ], 201);
            }

            if ($action === 'unassign') {
                $id = (int)($body['id'] ?? 0);
                $this->service->unassignTeaching(
                    (int)$admin['id'],
                    $id,
                    isset($admin['school_id']) ? (int)$admin['school_id'] : null
                );

                return Response::json([
                    'success' => true,
                    'data' => ['changed' => true],
                ]);
            }

            if ($action === 'create_subject') {
                $id = $this->service->createSubject(
                    (int)$admin['id'],
                    (string)($body['code'] ?? ''),
                    (string)($body['name_fr'] ?? ''),
                    (string)($body['name_ar'] ?? ''),
                    (string)($body['name_en'] ?? '')
                );

                return Response::json([
                    'success' => true,
                    'data' => ['id' => $id],
                ], 201);
            }

            if ($action === 'update_subject') {
                $id = (int)($body['id'] ?? 0);
                $this->service->updateSubject(
                    (int)$admin['id'],
                    $id,
                    (string)($body['code'] ?? ''),
                    (string)($body['name_fr'] ?? ''),
                    (string)($body['name_ar'] ?? ''),
                    (string)($body['name_en'] ?? ''),
                    array_key_exists('is_active', $body) ? (bool)$body['is_active'] : true
                );

                return Response::json([
                    'success' => true,
                    'data' => ['id' => $id],
                ]);
            }

            return Response::json([
                'success' => false,
                'error' => 'Unknown action.',
            ], 400);
        } catch (\Throwable $e) {
            return $this->error($e);
        }
    }
}