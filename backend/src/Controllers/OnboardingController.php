<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Exceptions\OnboardingWorkflowException;
use SAMS\Helpers\Security;
use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Services\OnboardingService;

final class OnboardingController
{
    public function __construct(
        private readonly OnboardingService $service = new OnboardingService()
    ) {}

    public function __invoke(Request $request, array $params = []): Response
    {
        $action = (string)($params['action'] ?? '');

        try {
            if ($request->method() === 'POST' && $action === 'request') {
                $body = $request->jsonBody();

                return Response::json([
                    'success' => true,
                    'data' => $this->service->requestTeacher(
                        (string)($body['onboarding_code'] ?? ''),
                        (string)($body['full_name'] ?? ''),
                        array_key_exists('employee_id', $body) ? (string)$body['employee_id'] : null,
                        array_key_exists('phone', $body) ? (string)$body['phone'] : null,
                        Security::clientIp(),
                        Security::userAgent()
                    ),
                ], 201);
            }

            if ($request->method() === 'GET' && $action === 'status') {
                return Response::json([
                    'success' => true,
                    'data' => $this->service->status((string)$request->queryValue('request_token', '')),
                ]);
            }

            if ($request->method() === 'POST' && $action === 'activate') {
                $body = $request->jsonBody();

                return Response::json([
                    'success' => true,
                    'data' => $this->service->activate(
                        (string)($body['request_token'] ?? ''),
                        (string)($body['password'] ?? '')
                    ),
                ]);
            }

            return Response::json([
                'success' => false,
                'error' => 'Onboarding route not found.',
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
            error_log('[SAMS onboarding] ' . $e->getMessage());
            return Response::json([
                'success' => false,
                'error' => 'Server error.',
            ], 500);
        }
    }
}
