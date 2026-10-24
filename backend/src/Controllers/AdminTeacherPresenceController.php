<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Services\TeacherAdministrationService;

final class AdminTeacherPresenceController extends AdminApiController
{
    public function __construct(
        private readonly TeacherAdministrationService $service = new TeacherAdministrationService()
    ) {}

    public function __invoke(Request $request, array $params = []): Response
    {
        $admin = $this->requireAdmin();

        if ($request->method() !== 'GET') {
            return Response::json([
                'success' => false,
                'error' => 'Method not allowed.',
            ], 405, ['Allow' => 'GET']);
        }

        try {
            return Response::json([
                'success' => true,
                'data' => $this->service->presence(
                    isset($admin['school_id']) ? (int)$admin['school_id'] : null
                ),
            ]);
        } catch (\Throwable $e) {
            return $this->error($e);
        }
    }
}
