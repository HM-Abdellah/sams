<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Exceptions\ArchiveReportException;
use SAMS\Helpers\Validation;
use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Services\ArchiveService;

final class ArchiveController
{
    public function __construct(private readonly ArchiveService $service = new ArchiveService()) {}

    public function __invoke(Request $request, array $params = []): Response
    {
        if ($request->method() !== 'GET') {
            return Response::json(['success' => false, 'error' => 'Method not allowed.'], 405, ['Allow' => 'GET']);
        }

        try {
            $this->startSession();
            $user = \SAMS\Helpers\Auth::requireRole('admin');
            $classId = Validation::id($request->queryValue('class_id'), 'class_id');
            $view = is_string($request->queryValue('view')) ? $request->queryValue('view') : 'days';
            $month = $request->queryValue('month');
            $date = $request->queryValue('date');
            $studentId = $request->queryValue('student_id') !== null
                ? Validation::id($request->queryValue('student_id'), 'student_id')
                : null;

            $data = $this->service->read(
                (int)$user['id'],
                (string)$user['role'],
                $classId,
                $view,
                is_string($month) ? $month : null,
                is_string($date) ? $date : null,
                $studentId,
                isset($user['school_id']) ? (int)$user['school_id'] : null
            );
            return Response::json(['success' => true, 'data' => $data]);
        } catch (ArchiveReportException $e) {
            return Response::json(['success' => false, 'error' => $e->getMessage()], $e->httpStatus());
        } catch (\InvalidArgumentException $e) {
            return Response::json(['success' => false, 'error' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            error_log('[SAMS archive API] ' . $e->getMessage());
            return Response::json(['success' => false, 'error' => 'Server error.'], 500);
        }
    }

    private function startSession(): void
    {
        \SAMS\Helpers\Security::startSession(
            (string)($GLOBALS['appConfig']['session_name'] ?? 'SAMS_SESSION'),
            (int)($GLOBALS['appConfig']['session_lifetime'] ?? 3600)
        );
    }
}