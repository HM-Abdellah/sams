<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Exceptions\ArchiveReportException;
use SAMS\Helpers\Auth;
use SAMS\Helpers\Security;
use SAMS\Helpers\Validation;
use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Services\ReportService;

final class ReportController
{
    public function __construct(private readonly ReportService $service = new ReportService()) {}

    public function validate(array $input): array
    {
        return [
            'class_id' => Validation::id($input['class_id'] ?? null, 'class_id'),
            'month' => Validation::month($input['month'] ?? null),
        ];
    }

    public function __invoke(Request $request, array $params = []): Response
    {
        $this->startSession();

        try {
            $user = Auth::requireLogin();
            $classId = isset($params['id']) && ctype_digit((string)$params['id'])
                ? (int)$params['id']
                : 0;

            if ($classId < 1) {
                return Response::json(['success' => false, 'error' => 'Invalid class.'], 422);
            }

            if ($request->method() !== 'GET') {
                return Response::json(
                    ['success' => false, 'error' => 'Method not allowed.'],
                    405,
                    ['Allow' => 'GET']
                );
            }

            $month = Validation::month($request->queryValue('month'));
            return Response::json([
                'success' => true,
                'data' => $this->service->monthly(
                    (int)$user['id'],
                    (string)$user['role'],
                    $classId,
                    $month,
                    isset($user['school_id']) ? (int)$user['school_id'] : null
                ),
            ]);
        } catch (ArchiveReportException $e) {
            return Response::json(['success' => false, 'error' => $e->getMessage()], $e->httpStatus());
        } catch (\InvalidArgumentException $e) {
            return Response::json(['success' => false, 'error' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            error_log('[SAMS report API] ' . $e->getMessage());
            return Response::json(['success' => false, 'error' => 'Server error.'], 500);
        }
    }

    private function startSession(): void
    {
        Security::startSession(
            (string)($GLOBALS['appConfig']['session_name'] ?? 'SAMS_SESSION'),
            (int)($GLOBALS['appConfig']['session_lifetime'] ?? 3600)
        );
    }
}
