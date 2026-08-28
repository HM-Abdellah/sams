<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Services\SignatureService;

final class SignatureController
{
    public function __construct(private readonly SignatureService $service = new SignatureService()) {}

    public function validate(array $input): string
    {
        return $this->service->validatePngDataUrl((string)($input['signature_data'] ?? ''));
    }
}
