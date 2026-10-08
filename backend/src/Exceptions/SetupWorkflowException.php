<?php

declare(strict_types=1);

namespace SAMS\Exceptions;

final class SetupWorkflowException extends \RuntimeException
{
    public function __construct(string $message, private readonly int $status = 409, ?\Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
    }

    public function httpStatus(): int
    {
        return $this->status;
    }
}

