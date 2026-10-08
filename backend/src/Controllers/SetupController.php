<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Exceptions\SetupWorkflowException;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Security;
use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Services\SetupService;

final class SetupController
{
    public function __construct(
        private readonly SetupService $service = new SetupService()
    ) {}

    public function __invoke(Request $request, array $params = []): Response
    {
        Security::startSession(
            (string)($GLOBALS['appConfig']['session_name'] ?? 'SAMS_SESSION'),
            (int)($GLOBALS['appConfig']['session_lifetime'] ?? 3600)
        );

        if ($request->method() === 'GET' && $request->path() === '/setup/status') {
            return Response::json([
                'success' => true,
                'data' => [
                    ...$this->service->status(),
                    'csrf' => Csrf::token(),
                ],
            ]);
        }

        if ($request->method() !== 'POST' || $request->path() !== '/setup') {
            return Response::json([
                'success' => false,
                'error' => 'Unsupported setup request.',
            ], 405);
        }

        if (!Csrf::verify($request->header('x-csrf-token'))) {
            return Response::json([
                'success' => false,
                'error' => 'Invalid CSRF token.',
            ], 419);
        }

        try {
            $body = $request->jsonBody();

            $result = $this->service->initialize(
                (string)($body['setup_key'] ?? ''),
                (string)($body['school_code'] ?? ''),
                (string)($body['school_name'] ?? ''),
                (string)($body['username'] ?? ''),
                (string)($body['full_name'] ?? ''),
                (string)($body['password'] ?? '')
            );

            return Response::json([
                'success' => true,
                'data' => [
                    ...$result,
                    'csrf' => Csrf::rotate(),
                ],
            ], 201);
        } catch (SetupWorkflowException $e) {
            return Response::json([
                'success' => false,
                'error' => $e->getMessage(),
            ], $e->httpStatus());
        }
    }
}

