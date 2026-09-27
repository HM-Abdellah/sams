<?php

declare(strict_types=1);

namespace SAMS\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SAMS\Helpers\Security;

final class SecurityTest extends TestCase
{
    public function testHttpSecurityHeadersAreRestrictive(): void
    {
        $headers = Security::responseHeaders(false);

        self::assertSame('nosniff', $headers['X-Content-Type-Options']);
        self::assertSame('same-origin', $headers['Referrer-Policy']);
        self::assertSame('DENY', $headers['X-Frame-Options']);
        self::assertSame(
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            $headers['Content-Security-Policy']
        );
        self::assertSame(
            'camera=(), geolocation=(), microphone=()',
            $headers['Permissions-Policy']
        );
        self::assertArrayNotHasKey('Strict-Transport-Security', $headers);
    }

    public function testHttpsResponsesIncludeHsts(): void
    {
        $headers = Security::responseHeaders(true);

        self::assertSame(
            'max-age=31536000; includeSubDomains',
            $headers['Strict-Transport-Security']
        );
    }
}