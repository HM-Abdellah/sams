<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Services\TeacherClassAdministrationService;

final class AdminTeacherClassController extends AdminApiController
{
    public function __construct(
        private readonly TeacherClassAdministrationService $service = new TeacherClassAdministrationService()
    ) {}

    public function __invoke(Request $request, array $params = []): Response
    {
        $admin = $this->requireAdmin();

        try {
            if ($request->method() === 'GET') {
                $classId = (int)($request->queryValue('class_id') ?? 0);
                $teacherId = (int)($request->queryValue('teacher_id') ?? 0);

                if ($classId > 0) {
                    return Response::json([
                        'success' => true,
                        'data' => ['teachers' => $this->service->forClass(
                            $classId,
                            isset($admin['school_id']) ? (int)$admin['school_id'] : null
                        )],
                    ]);
                }

                if ($teacherId > 0) {
                    return Response::json([
                        'success' => true,
                        'data' => ['classes' => $this->service->forTeacher(
                            $teacherId,
                            isset($admin['school_id']) ? (int)$admin['school_id'] : null
                        )],
                    ]);
                }

                throw new \InvalidArgumentException('Provide class_id or teacher_id.');
            }

            $csrfError = $this->requireCsrf($request);
            if ($csrfError !== null) return $csrfError;

            $body = $request->jsonBody();
            $teacherId = (int)($body['teacher_id'] ?? 0);
            $classId = (int)($body['class_id'] ?? 0);

            if ($request->method() === 'POST') {
                return Response::json([
                    'success' => true,
                    'data' => [
                        'changed' => $this->service->assign(
                            (int)$admin['id'],
                            $teacherId,
                            $classId,
                            isset($admin['school_id']) ? (int)$admin['school_id'] : null
                        ),
                    ],
                ]);
            }

            if ($request->method() === 'DELETE') {
                return Response::json([
                    'success' => true,
                    'data' => [
                        'changed' => $this->service->unassign(
                            (int)$admin['id'],
                            $teacherId,
                            $classId,
                            isset($admin['school_id']) ? (int)$admin['school_id'] : null
                        ),
                    ],
                ]);
            }

            return Response::json([
                'success' => false,
                'error' => 'Method not allowed.',
            ], 405, ['Allow' => 'GET, POST, DELETE']);
        } catch (\Throwable $e) {
            return $this->error($e);
        }
    }
}