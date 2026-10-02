[Reading 26 lines from start (total: 26 lines, 0 remaining)]

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

[executed on device: codespaces-052ecf (81686ebc-c2a3-4f3f-931c-1c91ab9990de)]