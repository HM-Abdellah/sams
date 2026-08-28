<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Helpers\Validation;

final class AuthController
{
    public function validateLogin(array $input): array
    {
        $username = Validation::requiredString($input['username'] ?? null, 'username', 50);
        $password = (string)($input['password'] ?? '');
        if ($password === '') throw new \InvalidArgumentException('Password is required.');
        return ['username' => $username, 'password' => $password];
    }
}
