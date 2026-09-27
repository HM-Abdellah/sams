<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Services\ClassAdministrationService;

final class AdminClassController extends AdminApiController
{
    public function __construct(
        private readonly ClassAdministrationService $service = new ClassAdministrationService()
    ) {}

    public function __invoke(Request $request, array $params = []): Response
    {
        $admin = $this->requireAdmin();

        if ($request->method() === 'GET') {
            try {
                return Response::json([
                    'success' => true,
                    'data' => ['classes' => $this->service->list()],
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
            $action = (string)($body['action'] ?? 'create');

            if ($action === 'create') {
                $id = $this->service->create(
                    (int)$admin['id'],
                    (string)($body['name'] ?? ''),
                    isset($body['level']) ? (string)$body['level'] : null,
                    isset($body['branch']) ? (string)$body['branch'] : null
                );

                return Response::json([
                    'success' => true,
                    'data' => ['id' => $id],
                ], 201);
            }

            if ($action === 'update') {
                $id = $this->service->update(
                    (int)$admin['id'],
                    (int)($body['id'] ?? 0),
                    array_key_exists('name', $body) ? (string)$body['name'] : null,
                    array_key_exists('level', $body) ? (string)$body['level'] : null,
                    array_key_exists('branch', $body) ? (string)$body['branch'] : null
                );

                return Response::json([
                    'success' => true,
                    'data' => ['id' => $id],
                ]);
            }

            if ($action === 'activate' || $action === 'deactivate') {
                $id = (int)($body['id'] ?? 0);
                $changed = $this->service->setActive(
                    (int)$admin['id'],
                    $id,
                    $action === 'activate'
                );

                return Response::json([
                    'success' => true,
                    'data' => ['changed' => $changed],
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