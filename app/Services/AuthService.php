<?php

declare(strict_types=1);

namespace SAMS\Services;

use RuntimeException;
use Throwable;
use SAMS\Helpers\Database;
use SAMS\Helpers\Security;
use SAMS\Repositories\UserRepository;

final class AuthService
{
    private UserRepository $users;

    public function __construct(?UserRepository $users = null)
    {
        $this->users = $users ?? new UserRepository();
    }

    public function authenticate(
        string $username,
        string $password,
        int $lockMinutes = 5,
        int $maxAttempts = 5
    ): array {
        if ($username === '' || $password === '') {
            throw new RuntimeException('Invalid credentials.');
        }

        $lockMinutes = max(1, $lockMinutes);
        $maxAttempts = max(1, min(65535, $maxAttempts));
        $pdo = Database::connection();

        $pdo->beginTransaction();
        try {
            // Lock the account row so concurrent failed requests cannot overwrite
            // each other's failure counters.
            $user = $this->users->findByUsernameForUpdate($username);

            if (!$user || !(bool)$user['is_active']) {
                $pdo->commit();
                throw new RuntimeException('Invalid credentials.');
            }

            if ($user['locked_until'] && strtotime((string)$user['locked_until']) > time()) {
                $pdo->commit();
                throw new RuntimeException('Account temporarily locked.');
            }

            if (!Security::verifyPassword($password, (string)$user['password_hash'])) {
                $attempts = min(65535, (int)$user['failed_login_attempts'] + 1);
                $lockSeconds = $lockMinutes * 60;
                $lockedUntil = $attempts >= $maxAttempts
                    ? date('Y-m-d H:i:s', time() + $lockSeconds)
                    : null;

                $this->users->recordLoginFailure((int)$user['id'], $attempts, $lockedUntil);
                $pdo->commit();
                throw new RuntimeException('Invalid credentials.');
            }

            if (Security::shouldRehashPassword((string)$user['password_hash'])) {
                $this->users->updatePasswordHash(
                    (int)$user['id'],
                    Security::hashPassword($password)
                );
            }

            $this->users->recordLoginSuccess((int)$user['id']);
            $pdo->commit();

            return [
                'id' => (int)$user['id'],
                'full_name' => (string)$user['full_name'],
                'role' => (string)$user['role'],
                'session_version' => (int)$user['session_version'],
            ];
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }
}
