<?php

declare(strict_types=1);

namespace SAMS\Tests\Unit\Routing;

use PHPUnit\Framework\TestCase;
use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Routing\Router;

final class RouterTest extends TestCase
{
    public function testDispatchesMatchingRoute(): void
    {
        $router = new Router();

        $router->get('/health', static function (): Response {
            return Response::json(['success' => true, 'data' => ['status' => 'ok']]);
        });

        $response = $router->dispatch(new Request('GET', '/health'));

        self::assertSame(200, $response->status());
        self::assertSame(
            '{"success":true,"data":{"status":"ok"}}',
            $response->body()
        );
    }

    public function testRejectsWrongMethodAndAdvertisesAllowedMethods(): void
    {
        $router = new Router();

        $router->get('/health', static function (): Response {
            return Response::json(['success' => true]);
        });

        $response = $router->dispatch(new Request('POST', '/health'));

        self::assertSame(405, $response->status());
        self::assertSame('GET', $response->headers()['Allow']);
    }

    public function testExtractsNamedPathParameters(): void
    {
        $router = new Router();

        $router->get('/classes/{classId}/attendance', static function (
            Request $request,
            array $params
        ): Response {
            return Response::json([
                'success' => true,
                'data' => ['class_id' => $params['classId'] ?? null],
            ]);
        });

        $response = $router->dispatch(
            new Request('GET', '/classes/42/attendance')
        );

        self::assertSame(200, $response->status());
        self::assertSame(
            '{"success":true,"data":{"class_id":"42"}}',
            $response->body()
        );
    }

    public function testReturnsNotFoundForUnknownRoute(): void
    {
        $router = new Router();

        $response = $router->dispatch(new Request('GET', '/missing'));

        self::assertSame(404, $response->status());
    }
}
