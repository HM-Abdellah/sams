<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class SetupRepository
{
    public const LOCK_NAME = 'sams.setup.first-installation';

    /** @return array{schools:int,admins:int} */
    public function installationState(): array
    {
        $row = Database::connection()->query(
            "SELECT
                (SELECT COUNT(*) FROM schools) AS school_count,
                (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admin_count"
        )->fetch();

        return [
            'schools' => (int)($row['school_count'] ?? 0),
            'admins' => (int)($row['admin_count'] ?? 0),
        ];
    }

    public function schoolCodeExists(string $code): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT id FROM schools WHERE code = ? LIMIT 1'
        );
        $stmt->execute([$code]);

        return $stmt->fetchColumn() !== false;
    }

    public function usernameExists(string $username): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT id FROM users WHERE username = ? LIMIT 1'
        );
        $stmt->execute([$username]);

        return $stmt->fetchColumn() !== false;
    }

    public function createSchool(string $code, string $name): int
    {
        $stmt = Database::connection()->prepare(
            "INSERT INTO schools (code, name, status)
             VALUES (?, ?, 'active')"
        );
        $stmt->execute([$code, $name]);

        return (int)Database::connection()->lastInsertId();
    }

    public function createAdmin(
        int $schoolId,
        string $username,
        string $fullName,
        string $passwordHash
    ): int {
        $stmt = Database::connection()->prepare(
            "INSERT INTO users
                (school_id, username, full_name, password_hash, role, account_status, is_active)
             VALUES (?, ?, ?, ?, 'admin', 'active', 1)"
        );
        $stmt->execute([$schoolId, $username, $fullName, $passwordHash]);

        return (int)Database::connection()->lastInsertId();
    }

    public function acquireLock(): bool
    {
        $stmt = Database::connection()->prepare('SELECT GET_LOCK(?, 10)');
        $stmt->execute([self::LOCK_NAME]);

        return (int)$stmt->fetchColumn() === 1;
    }

    public function releaseLock(): void
    {
        $stmt = Database::connection()->prepare('SELECT RELEASE_LOCK(?)');
        $stmt->execute([self::LOCK_NAME]);
    }
}

