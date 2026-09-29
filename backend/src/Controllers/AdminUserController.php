<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Services\LoginCodeService;
use SAMS\Services\UserAdministrationService;

final class AdminUserController extends AdminApiController
{
    public function __construct(
        private readonly UserAdministrationService $service = new UserAdministrationService()
    ) {}

    public function __invoke(Request $request, array $params = []): Response
    {
        $admin = $this->requireAdmin();

        if ($request->method() === 'GET') {
            try {
                return Response::json([
                    'success' => true,
                    'data' => [
                        'users' => $this->service->list(
                            isset($admin['school_id']) ? (int)$admin['school_id'] : null
                        ),
                    ],
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

            if ($action === 'create') {
                $id = $this->service->create(
                    (int)$admin['id'],
                    (string)($body['username'] ?? ''),
                    (string)($body['full_name'] ?? ''),
                    (string)($body['role'] ?? ''),
                    (string)($body['password'] ?? ''),
                    isset($body['employee_id']) ? (string)$body['employee_id'] : null,
                    isset($body['phone']) ? (string)$body['phone'] : null,
                    isset($admin['school_id']) ? (int)$admin['school_id'] : null
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
                    array_key_exists('full_name', $body) ? (string)$body['full_name'] : null,
                    array_key_exists('role', $body) ? (string)$body['role'] : null,
                    array_key_exists('is_active', $body) ? (bool)$body['is_active'] : null,
                    array_key_exists('employee_id', $body) ? (string)$body['employee_id'] : null,
                    array_key_exists('phone', $body) ? (string)$body['phone'] : null,
                    isset($admin['school_id']) ? (int)$admin['school_id'] : null
                );

                return Response::json([
                    'success' => true,
                    'data' => ['id' => $id],
                ]);
            }

            if ($action === 'reset_password') {
                $this->service->resetPassword(
                    (int)$admin['id'],
                    (int)($body['id'] ?? 0),
                    (string)($body['password'] ?? ''),
                    isset($admin['school_id']) ? (int)$admin['school_id'] : null
                );

                return Response::json(['success' => true, 'data' => null]);
            }

            if ($action === 'unlock') {
                $id = (int)($body['id'] ?? 0);
                $this->service->unlock(
                    (int)$admin['id'],
                    $id,
                    isset($admin['school_id']) ? (int)$admin['school_id'] : null
                );

                return Response::json([
                    'success' => true,
                    'data' => ['id' => $id],
                ]);
            }

            if ($action === 'reissue_sams_code') {
                $schoolId = (int)($admin['school_id'] ?? 0);
                if ($schoolId < 1) {
                    return Response::json([
                        'success' => false,
                        'error' => 'Invalid school scope.',
                    ], 500);
                }

                $issued = (new LoginCodeService())->issueForUser(
                    (int)$admin['id'],
                    (int)($body['id'] ?? 0),
                    $schoolId
                );

                return Response::json([
                    'success' => true,
                    'data' => [
                        'user_id' => $issued['user_id'],
                        'sams_code' => $issued['sams_code'],
                    ],
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