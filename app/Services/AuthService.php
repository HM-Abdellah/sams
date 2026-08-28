<?php

declare(strict_types=1);

namespace SAMS\Services;

use SAMS\Helpers\Security;
use SAMS\Repositories\UserRepository;
use RuntimeException;

final class AuthService
{
    public function __construct(private readonly UserRepository $users = new UserRepository()) {}

    public function authenticate(string $username, string $password): array
    {
        $user = $this->users->findByUsername($username);
        if (!$user || !(bool)$user['is_active']) throw new RuntimeException('Invalid credentials.');
        if ($user['locked_until'] && strtotime((string)$user['locked_until']) > time()) throw new RuntimeException('Account temporarily locked.');

        if (!Security::verifyPassword($password, (string)$user['password_hash'])) {
            $attempts = (int)$user['failed_login_attempts'] + 1;
            $lockedUntil = $attempts >= 5 ? date('Y-m-d H:i:s', time() + 300) : null;
            $this->users->recordLoginFailure((int)$user['id'], $attempts, $lockedUntil);
            throw new RuntimeException('Invalid credentials.');
        }

        if (Security::shouldRehashPassword((string)$user['password_hash'])) {
            $hash = Security::hashPassword($password);
            // Password rehashing can be added to the repository without exposing the hash elsewhere.
            // The current schema/API remains compatible with PASSWORD_DEFAULT.
        }

        $this->users->recordLoginSuccess((int)$user['id']);
        return ['id'=>(int)$user['id'], 'full_name'=>(string)$user['full_name'], 'role'=>(string)$user['role']];
    }
}
