<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Services\AcademicYearAdministrationService;

final class AdminAcademicYearController extends AdminApiController
{
    public function __construct(
        private readonly AcademicYearAdministrationService $service = new AcademicYearAdministrationService()
    ) {}

    public function __invoke(Request $request, array $params = []): Response
    {
        if ($request->method() === 'GET') {
            $actor = $this->requireAdminOrCounselor();

            try {
                return Response::json([
                    'success' => true,
                    'data' => [
                        'academic_years' => $this->service->list(
                            isset($actor['school_id']) ? (int)$actor['school_id'] : null
                        ),
                    ],
                ]);
            } catch (\Throwable $e) {
                return $this->error($e);
            }
        }

        $admin = $this->requireAdmin();
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

            if ($action === 'create') {
                $id = $this->service->create(
                    (int)$admin['id'],
                    (string)($body['name'] ?? ''),
                    (string)($body['starts_on'] ?? ''),
                    (string)($body['ends_on'] ?? ''),
                    !empty($body['activate']),
                    isset($admin['school_id']) ? (int)$admin['school_id'] : null
                );

                return Response::json([
                    'success' => true,
                    'data' => ['id' => $id],
                ], 201);
            }

            if ($action === 'delete') {
                $id = (int)($body['id'] ?? 0);
                $this->service->delete(
                    (int)$admin['id'],
                    $id,
                    isset($admin['school_id']) ? (int)$admin['school_id'] : null
                );

                return Response::json([
                    'success' => true,
                    'data' => null,
                ]);
            }

            if ($action === 'activate') {
                $id = (int)($body['id'] ?? 0);
                $this->service->activate(
                    (int)$admin['id'],
                    $id,
                    isset($admin['school_id']) ? (int)$admin['school_id'] : null
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

