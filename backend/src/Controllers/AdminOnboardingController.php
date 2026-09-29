<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Exceptions\OnboardingWorkflowException;
use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Services\OnboardingService;

final class AdminOnboardingController extends AdminApiController
{
    public function __construct(
        private readonly OnboardingService $service = new OnboardingService()
    ) {}

    public function __invoke(Request $request, array $params = []): Response
    {
        $admin = $this->requireAdmin();
        $schoolId = (int)($admin['school_id'] ?? 0);
        if ($schoolId < 1) {
            return Response::json([
                'success' => false,
                'error' => 'Invalid school scope.',
            ], 500);
        }

        try {
            if ($request->method() === 'GET' && ($params['action'] ?? '') === 'requests') {
                return Response::json([
                    'success' => true,
                    'data' => [
                        'requests' => $this->service->listRequests(
                            (int)$admin['id'],
                            $schoolId,
                            $request->queryValue('status') !== null
                                ? (string)$request->queryValue('status')
                                : null
                        ),
                    ],
                ]);
            }

            if ($request->method() !== 'POST') {
                return Response::json([
                    'success' => false,
                    'error' => 'Method not allowed.',
                ], 405, ['Allow' => 'GET, POST']);
            }

            $csrfError = $this->requireCsrf($request);
            if ($csrfError !== null) return $csrfError;

            $body = $request->jsonBody();
            $action = (string)($params['action'] ?? ($body['action'] ?? ''));

            if ($action === 'code') {
                return Response::json([
                    'success' => true,
                    'data' => $this->service->issueSchoolCode(
                        (int)$admin['id'],
                        $schoolId
                    ),
                ]);
            }

            if ($action === 'review') {
                $requestId = isset($params['id']) && ctype_digit((string)$params['id'])
                    ? (int)$params['id']
                    : 0;
                if ($requestId < 1) {
                    return Response::json([
                        'success' => false,
                        'error' => 'Invalid onboarding request.',
                    ], 422);
                }

                return Response::json([
                    'success' => true,
                    'data' => $this->service->review(
                        (int)$admin['id'],
                        $requestId,
                        (string)($body['decision'] ?? $body['action'] ?? ''),
                        array_key_exists('reason', $body) ? (string)$body['reason'] : null,
                        $schoolId
                    ),
                ]);
            }

            return Response::json([
                'success' => false,
                'error' => 'Onboarding admin action not found.',
            ], 404);
        } catch (OnboardingWorkflowException $e) {
            return Response::json([
                'success' => false,
                'error' => $e->getMessage(),
            ], $e->httpStatus());
        } catch (\InvalidArgumentException $e) {
            return Response::json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            return $this->error($e);
        }
    }
}
