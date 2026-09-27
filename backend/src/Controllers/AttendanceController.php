<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Exceptions\AttendanceWorkflowException;
use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Security;
use SAMS\Helpers\Validation;
use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Services\AttendanceService;
use SAMS\Services\TeacherAttendanceService;

final class AttendanceController
{
    public function __construct(
        private readonly AttendanceService $validator = new AttendanceService(),
        private readonly TeacherAttendanceService $workflow = new TeacherAttendanceService(),
    ) {}

    public function validatePayload(array $input): array
    {
        $studentId = Validation::id($input['student_id'] ?? null, 'student_id');
        $date = Validation::date($input['attendance_date'] ?? null, 'attendance_date');
        $period = Validation::period($input['period'] ?? null);
        $status = Validation::enum($input['status'] ?? 'present', 'status', AttendanceService::STATUSES);
        $this->validator->validate($studentId, $date, $period, $status);

        return [
            'student_id' => $studentId,
            'attendance_date' => $date,
            'period' => $period,
            'status' => $status,
        ];
    }

    public function __invoke(Request $request, array $params = []): Response
    {
        Security::startSession(
            (string)($GLOBALS['appConfig']['session_name'] ?? 'SAMS_SESSION'),
            (int)($GLOBALS['appConfig']['session_lifetime'] ?? 3600)
        );

        $classId = isset($params['id']) && ctype_digit((string)$params['id'])
            ? (int)$params['id']
            : 0;

        if ($classId < 1) {
            return Response::json([
                'success' => false,
                'error' => 'Invalid class.',
            ], 422);
        }

        try {
            if ($request->method() === 'GET') {
                $user = Auth::requireLogin();
                $weekStart = $request->queryValue('week_start');

                if (!is_string($weekStart) || trim($weekStart) === '') {
                    throw new \InvalidArgumentException('week_start is required.');
                }

                return Response::json([
                    'success' => true,
                    'data' => $this->workflow->weeklyRegister(
                        (int)$user['id'],
                        (string)$user['role'],
                        $classId,
                        $weekStart
                    ),
                ]);
            }

            $user = Auth::requireRole('admin', 'teacher');

            if (!Csrf::verify($request->header('x-csrf-token'))) {
                return Response::json([
                    'success' => false,
                    'error' => 'Invalid CSRF token.',
                ], 419);
            }

            if ($request->method() !== 'POST') {
                return Response::json([
                    'success' => false,
                    'error' => 'Method not allowed.',
                ], 405, ['Allow' => 'GET, POST']);
            }

            $body = $request->jsonBody();
            $entries = $body['entries'] ?? null;
            if (!is_array($entries)) {
                throw new \InvalidArgumentException('Attendance entries are required.');
            }

            return Response::json([
                'success' => true,
                'data' => $this->workflow->saveBulk(
                    (int)$user['id'],
                    (string)$user['role'],
                    $classId,
                    $entries
                ),
            ]);
        } catch (AttendanceWorkflowException $e) {
            return Response::json([
                'success' => false,
                'error' => $e->getMessage(),
            ], $e->httpStatus());
        } catch (\InvalidArgumentException $e) {
            return Response::json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 422);
        }
    }
}