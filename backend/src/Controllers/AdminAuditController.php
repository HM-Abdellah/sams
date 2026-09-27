<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Helpers\Validation;
use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Services\AuditAdministrationService;

final class AdminAuditController extends AdminApiController
{
    public function __construct(
        private readonly AuditAdministrationService $service = new AuditAdministrationService()
    ) {}

    public function __invoke(Request $request, array $params = []): Response
    {
        $this->requireAdmin();

        if ($request->method() !== 'GET') {
            return Response::json([
                'success' => false,
                'error' => 'Method not allowed.',
            ], 405, ['Allow' => 'GET']);
        }

        try {
            $userId = null;
            if (($value = $request->queryValue('user_id')) !== null && (string)$value !== '') {
                $userId = Validation::id($value, 'user_id');
            }

            $action = ($value = $request->queryValue('action')) !== null
                ? trim((string)$value)
                : null;
            $entityType = ($value = $request->queryValue('entity_type')) !== null
                ? trim((string)$value)
                : null;
            $from = ($value = $request->queryValue('from')) !== null
                ? Validation::date($value, 'from')
                : null;
            $to = ($value = $request->queryValue('to')) !== null
                ? Validation::date($value, 'to')
                : null;

            $page = ($value = $request->queryValue('page')) !== null
                ? Validation::id($value, 'page')
                : 1;
            $perPage = ($value = $request->queryValue('per_page')) !== null
                ? Validation::id($value, 'per_page')
                : 50;

            return Response::json([
                'success' => true,
                'data' => $this->service->search(
                    $userId,
                    $action,
                    $entityType,
                    $from,
                    $to,
                    $page,
                    $perPage
                ),
            ]);
        } catch (\Throwable $e) {
            return $this->error($e);
        }
    }
}