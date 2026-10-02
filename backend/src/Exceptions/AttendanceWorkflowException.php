<?php

declare(strict_types=1);

namespace SAMS\Exceptions;

final class AttendanceWorkflowException extends \RuntimeException
{
    public function __construct(
        string $message,
        private readonly int $httpStatus = 409,
        private readonly ?string $errorCode = null
    ) {
        parent::__construct($message);
    }

    public function httpStatus(): int
    {
        return $this->httpStatus;
    }

    public function errorCode(): ?string
    {
        return $this->errorCode;
    }
}
