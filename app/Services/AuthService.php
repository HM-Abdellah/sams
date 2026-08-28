<?php

declare(strict_types=1);

namespace SAMS\Services;

use RuntimeException;
use SAMS\Helpers\Security;
use SAMS\Repositories\UserRepository;

final class AuthService
{
    private UserRepository $users;

    public function __construct(?UserRepository $users = null)
    {
        $this->users = $users ?? new UserRepository();
    }

    public function authenticate(string $username, string $password, int $lockMinutes = 5): array
    {
        $user = $this->users->findByUsername($username);
        if (!$user || !(bool)$user['is_active']) throw new RuntimeException('Invalid credentials.');

        if ($user['locked_until'] && strtotime((string)$user['locked_until']) > time()) {
            throw new RuntimeException('Account temporarily locked.');
        }

        if (!Security::verifyPassword($password, (string)$user['password_hash'])) {
            $attempts = (int)$user['failed_login_attempts'] + 1;
            $lockSeconds = max(60, $lockMinutes * 60);
            $lockedUntil = $attempts >= 5 ? date('Y-m-d H:i:s', time() + $lockSeconds) : null;
            $this->users->recordLoginFailure((int)$user['id'], $attempts, $lockedUntil);
            throw new RuntimeException('Invalid credentials.');
        }

        $this->users->recordLoginSuccess((int)$user['id']);
        return [
            'id' => (int)$user['id'],
            'full_name' => (string)$user['full_name'],
            'role' => (string)$user['role'],
        ];
    }
}
