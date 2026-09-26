<?php

declare(strict_types=1);

namespace SAMS\Services;

use DateTimeImmutable;
use InvalidArgumentException;

final class StudentService
{
    public function validateName(string $value, string $field): string
    {
        $value = trim((string)(preg_replace('/\s+/u', ' ', $value) ?? ''));
        if ($value === '' || mb_strlen($value) > 80) {
            throw new InvalidArgumentException("Invalid {$field}.");
        }
        return $value;
    }

    public function normalizeNumber(?string $number): ?string
    {
        $number = trim((string)($number ?? ''));
        if ($number === '') return null;
        if (mb_strlen($number) > 30) {
            throw new InvalidArgumentException('Invalid student number.');
        }
        return $number;
    }

    public function normalizeMassarCode(?string $code): ?string
    {
        $code = trim((string)($code ?? ''));
        if ($code === '') return null;
        if (mb_strlen($code) > 32) {
            throw new InvalidArgumentException('Invalid Massar code.');
        }
        return $code;
    }

    public function validateBirthDate(?string $value): ?string
    {
        $value = trim((string)($value ?? ''));
        if ($value === '') return null;

        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) {
            throw new InvalidArgumentException('Invalid birth date.');
        }

        if ($date > new DateTimeImmutable('today')) {
            throw new InvalidArgumentException('Birth date cannot be in the future.');
        }

        return $value;
    }
}
