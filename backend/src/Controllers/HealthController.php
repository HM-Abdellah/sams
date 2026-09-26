<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Http\Request;
use SAMS\Http\Response;

final class HealthController
{
    public function __invoke(Request $request, array $params = []): Response
    {
        return Response::json([
            'success' => true,
            'data' => [
                'status' => 'ok',
                'service' => 'sams-api',
                'api_version' => 'v1',
            ],
        ]);
    }
}
