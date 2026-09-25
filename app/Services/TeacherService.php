<?php

declare(strict_types=1);

namespace SAMS\Services;

use InvalidArgumentException;

final class TeacherService
{
    public function validateEmployeeId(string $value): string
    {
        $value = trim((string)(preg_replace('/\s+/u', ' ', $value) ?? ''));
        if ($value === '' || mb_strlen($value) > 50 || !preg_match('/^[A-Za-z0-9._-]+$/', $value)) {
            throw new InvalidArgumentException('Invalid employee ID.');
        }
        return $value;
    }

    public function validatePhone(?string $value): ?string
    {
        if ($value === null || trim($value) === '') return null;
        $value = preg_replace('/[\s().-]+/', '', trim($value)) ?? '';
        if (!preg_match('/^\+?[0-9]{8,15}$/', $value)) {
            throw new InvalidArgumentException('Invalid phone number.');
        }
        return $value;
    }

    public function validateSubjectCode(string $value): string
    {
        $value = strtoupper(trim($value));
        if ($value === '' || mb_strlen($value) > 30 || !preg_match('/^[A-Z0-9._-]+$/', $value)) {
            throw new InvalidArgumentException('Invalid subject code.');
        }
        return $value;
    }

    public function validateSubjectName(string $value, string $field): string
    {
        $value = trim((string)(preg_replace('/\s+/u', ' ', $value) ?? ''));
        if ($value === '' || mb_strlen($value) > 120) {
            throw new InvalidArgumentException("Invalid {$field}.");
        }
        return $value;
    }
}
