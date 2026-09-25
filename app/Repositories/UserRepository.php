<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class UserRepository
{
    public function findByUsername(string $username): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, username, full_name, password_hash, role, is_active, failed_login_attempts, locked_until, session_version, last_login_at
             FROM users WHERE username = ? LIMIT 1'
        );
        $stmt->execute([$username]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

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
            'SELECT id, username, full_name, role, is_active
             FROM users
             WHERE id = ? AND is_active = 1
             LIMIT 1'
        );
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findById(int $userId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, username, full_name, role, is_active, failed_login_attempts, locked_until, session_version, last_login_at, created_at, updated_at
             FROM users
             WHERE id = ?
             LIMIT 1'
        );
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function forAdmin(): array
    {
        return Database::connection()->query(
            'SELECT id, username, full_name, role, is_active, failed_login_attempts,
                    locked_until, last_login_at, created_at, updated_at
             FROM users
             ORDER BY full_name, username, id'
        )->fetchAll();
    }

    public function create(string $username, string $fullName, string $passwordHash, string $role): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO users (username, full_name, password_hash, role, is_active)
             VALUES (?, ?, ?, ?, 1)'
        );
        $stmt->execute([$username, $fullName, $passwordHash, $role]);
        return (int)Database::connection()->lastInsertId();
    }

    public function updateProfile(
        int $userId,
        string $fullName,
        string $role,
        bool $isActive
    ): void {
        $stmt = Database::connection()->prepare(
            'UPDATE users
             SET full_name = ?,
                 role = ?,
                 is_active = ?,
                 session_version = session_version + 1
             WHERE id = ?'
        );
        $stmt->execute([$fullName, $role, $isActive ? 1 : 0, $userId]);
    }

    public function updatePasswordHash(int $userId, string $passwordHash): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE users
             SET password_hash = ?,
                 failed_login_attempts = 0,
                 locked_until = NULL,
                 session_version = session_version + 1
             WHERE id = ?'
        );
        $stmt->execute([$passwordHash, $userId]);
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
            'UPDATE users
             SET failed_login_attempts = 0,
                 locked_until = NULL,
                 last_login_at = CURRENT_TIMESTAMP
             WHERE id = ?'
        );
        $stmt->execute([$userId]);
    }

    public function countActiveAdmins(): int
    {
        return (int)Database::connection()->query(
            'SELECT COUNT(*) FROM users WHERE role = \'admin\' AND is_active = 1'
        )->fetchColumn();
    }
}
