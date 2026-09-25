<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class UserRepository
{
    public function findByUsername(string $username): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, username, full_name, password_hash, role, is_active, failed_login_attempts, locked_until, last_login_at
             FROM users WHERE username = ? LIMIT 1'
        );
        $stmt->execute([$username]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /** Fetch a login row while holding a row lock for atomic failure counting. */
    public function findByUsernameForUpdate(string $username): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, username, full_name, password_hash, role, is_active, failed_login_attempts, locked_until, last_login_at
             FROM users WHERE username = ? LIMIT 1 FOR UPDATE'
        );
        $stmt->execute([$username]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findActiveById(int $userId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, username, full_name, role, is_active FROM users WHERE id = ? AND is_active = 1 LIMIT 1'
        );
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function recordLoginFailure(int $userId, int $attempts, ?string $lockedUntil): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?'
        );
        $stmt->execute([$attempts, $lockedUntil, $userId]);
    }

    public function recordLoginSuccess(int $userId): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = ?'
        );
        $stmt->execute([$userId]);
    }

    public function updatePasswordHash(int $userId, string $passwordHash): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE users SET password_hash = ? WHERE id = ?'
        );
        $stmt->execute([$passwordHash, $userId]);
    }
}
