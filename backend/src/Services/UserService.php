<?php

declare(strict_types=1);

namespace SAMS\Services;

use InvalidArgumentException;

final class UserService
{
    public const ROLES = ['admin', 'teacher', 'counselor'];

    public function validateUsername(string $value): string
    {
        $value = trim($value);
        if ($value === '' || mb_strlen($value) > 50) {
            throw new InvalidArgumentException('Invalid username.');
        }
        return $value;
    }

    public function validateFullName(string $value): string
    {
        $value = trim((string)(preg_replace('/\s+/u', ' ', $value) ?? ''));
        if ($value === '' || mb_strlen($value) > 120) {
            throw new InvalidArgumentException('Invalid full name.');
        }
        return $value;
    }

    public function validateRole(string $role): string
    {
        if (!in_array($role, self::ROLES, true)) {
            throw new InvalidArgumentException('Invalid user role.');
        }
        return $role;
    }

    public function validatePassword(string $password): string
    {
        if (strlen($password) < 10 || strlen($password) > 255) {
            throw new InvalidArgumentException('Password must contain between 10 and 255 characters.');
        }
        return $password;
    }
}
