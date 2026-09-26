<?php

declare(strict_types=1);

namespace SAMS\Services;

use InvalidArgumentException;

final class ClassService
{
    public function normalizeName(string $name): string
    {
        $name = trim((string)(preg_replace('/\s+/u', ' ', $name) ?? ''));
        if ($name === '' || mb_strlen($name) > 100) throw new InvalidArgumentException('Invalid class name.');
        return $name;
    }

    public function optionalText(?string $value, int $max): ?string
    {
        $value = trim((string)($value ?? ''));
        if ($value === '') return null;
        if (mb_strlen($value) > $max) throw new InvalidArgumentException('Field is too long.');
        return $value;
    }
}
