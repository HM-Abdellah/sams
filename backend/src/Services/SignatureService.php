<?php

declare(strict_types=1);

namespace SAMS\Services;

use InvalidArgumentException;

final class SignatureService
{
    public function validatePngDataUrl(string $data): string
    {
        if (!preg_match('/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/', $data)) {
            throw new InvalidArgumentException('Invalid PNG signature data.');
        }
        if (strlen($data) > 500000) throw new InvalidArgumentException('Signature is too large.');
        return $data;
    }
}
