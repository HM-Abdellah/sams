<?php

declare(strict_types=1);

namespace SAMS\Tests\Unit\Http;

use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use SAMS\Http\Request;

final class RequestTest extends TestCase
{
    public function testHeaderLookupIsCaseInsensitive(): void
    {
        $request = new Request(
            'GET',
            '/health',
            [],
            ['x-csrf-token' => 'example-token']
        );

        self::assertSame('example-token', $request->header('X-CSRF-Token'));
    }

    public function testJsonBodyRejectsInvalidJson(): void
    {
        $request = new Request(
            'POST',
            '/example',
            [],
            [],
            '{invalid'
        );

        $this->expectException(InvalidArgumentException::class);

        $request->jsonBody();
    }

    public function testWithPathPreservesRequestData(): void
    {
        $request = new Request(
            'POST',
            '/api/v1/example',
            ['page' => '2'],
            ['accept' => 'application/json'],
            '{"ok":true}'
        );

        $apiRequest = $request->withPath('/example');

        self::assertSame('/example', $apiRequest->path());
        self::assertSame('2', $apiRequest->queryValue('page'));
        self::assertSame('application/json', $apiRequest->header('Accept'));
        self::assertSame('{"ok":true}', $apiRequest->rawBody());
    }
}
