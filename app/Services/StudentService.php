<?php

declare(strict_types=1);

namespace SAMS\Services;

use InvalidArgumentException;

final class StudentService
{
    public function validateName(string $value, string $field): string
    {
        $value = trim((string)(preg_replace('/\s+/u', ' ', $value) ?? ''));
        if ($value === '' || mb_strlen($value) > 80) throw new InvalidArgumentException("Invalid {$field}.");
        return $value;
    }

    public function normalizeNumber(?string $number): ?string
    {
        $number = trim((string)($number ?? ''));
        if ($number === '') return null;
        if (mb_strlen($number) > 30) throw new InvalidArgumentException('Invalid student number.');
        return $number;
    }
}
