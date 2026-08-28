<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Services\SignatureService;

final class SignatureController
{
    private SignatureService $service;

    public function __construct(?SignatureService $service = null)
    {
        $this->service = $service ?? new SignatureService();
    }

    public function validate(array $input): string
    {
        return $this->service->validatePngDataUrl((string)($input['signature_data'] ?? ''));
    }
}
