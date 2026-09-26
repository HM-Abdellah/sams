<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/bootstrap.php';

use SAMS\Controllers\HealthController;
use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Routing\Router;

try {
    $request = Request::fromGlobals();
    $prefix = '/api/v1';
    $path = $request->path();
    $marker = strpos($path, $prefix);

    if ($marker === false) {
        Response::json([
            'success' => false,
            'error' => 'API route not found.',
        ], 404)->send();
    }

    $afterPrefix = substr($path, $marker + strlen($prefix));

    if ($afterPrefix !== '' && $afterPrefix[0] !== '/') {
        Response::json([
            'success' => false,
            'error' => 'API route not found.',
        ], 404)->send();
    }

    $apiPath = $afterPrefix === '' ? '/' : $afterPrefix;
    $apiRequest = $request->withPath($apiPath);

    $router = new Router();

    $router->get('/health', new HealthController());

    $router->get('/', static function (): Response {
        return Response::json([
            'success' => true,
            'data' => [
                'service' => 'sams-api',
                'api_version' => 'v1',
            ],
        ]);
    });

    $router->dispatch($apiRequest)->send();
} catch (InvalidArgumentException $e) {
    Response::json([
        'success' => false,
        'error' => $e->getMessage(),
    ], 422)->send();
} catch (Throwable $e) {
    error_log('[SAMS API] ' . $e->getMessage());

    Response::json([
        'success' => false,
        'error' => 'Server error.',
    ], 500)->send();
}
