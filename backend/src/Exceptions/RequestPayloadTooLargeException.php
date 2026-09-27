<?php

declare(strict_types=1);

namespace SAMS\Exceptions;

final class RequestPayloadTooLargeException extends \InvalidArgumentException
{
    public function httpStatus(): int
    {
        return 413;
    }
}