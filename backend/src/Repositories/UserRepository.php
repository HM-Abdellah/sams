<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class UserRepository
{
    public function findByUsername(string $username): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, school_id, username, employee_id, full_name, phone, phone_verified, password_hash, role, account_status, is_active, failed_login_attempts, locked_until, session_version, last_login_at, last_seen_at
             FROM users WHERE username = ? LIMIT 1'
        );
        $stmt->execute([$username]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findByUsernameForUpdate(string $username): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, school_id, username, employee_id, full_name, phone, phone_verified, password_hash, role, account_status, is_active,
                    failed_login_attempts, locked_until, session_version, last_login_at, last_seen_at
             FROM users WHERE username = ? LIMIT 1 FOR UPDATE'
        );
        $stmt->execute([$username]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findActiveById(int $userId): ?array
    {
        $stmt = Database::connection()->prepare(
            "SELECT id, school_id, username, employee_id, full_name, phone, phone_verified, role, account_status, is_active, session_version
             FROM users
             WHERE id = ? AND is_active = 1 AND account_status = 'active'
             LIMIT 1"
        );
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findByIdForUpdate(int $userId, ?int $schoolId = null): ?array
    {
        $sql = 'SELECT id, school_id, username, employee_id, full_name, phone, phone_verified, role, account_status, is_active,
                       failed_login_attempts, locked_until, session_version, last_login_at, last_seen_at,
                       created_at, updated_at
                FROM users
                WHERE id = ?';
        $params = [$userId];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' AND school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' LIMIT 1 FOR UPDATE';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function activeAdminIdsForUpdate(?int $schoolId = null): array
    {
        $sql = "SELECT id
                FROM users
                WHERE role = 'admin' AND is_active = 1";
        $params = [];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' AND school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' ORDER BY id FOR UPDATE';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return array_map(
            static fn(array $row): int => (int)$row['id'],
            $stmt->fetchAll()
        );
    }

    public function findById(int $userId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, school_id, username, employee_id, full_name, phone, phone_verified, role, account_status, is_active, failed_login_attempts, locked_until, session_version, last_login_at, last_seen_at, created_at, updated_at
             FROM users
             WHERE id = ?
             LIMIT 1'
        );
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function forAdmin(?int $schoolId = null): array
    {
        $sql = 'SELECT id, school_id, username, employee_id, full_name, phone, phone_verified, role, account_status, is_active, failed_login_attempts,
                       locked_until, last_login_at, last_seen_at, created_at, updated_at
                FROM users';
        $params = [];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' WHERE school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' ORDER BY full_name, username, id';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function create(string $username, string $fullName, string $passwordHash, string $role, ?string $employeeId = null, ?string $phone = null, ?int $schoolId = null): int
    {
        if ($schoolId === null) {
            $stmt = Database::connection()->prepare(
                'INSERT INTO users (username, employee_id, full_name, phone, password_hash, role, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, 1)'
            );
            $stmt->execute([$username, $employeeId, $fullName, $phone, $passwordHash, $role]);
        } else {
            $this->assertSchoolId($schoolId);
            $stmt = Database::connection()->prepare(
                'INSERT INTO users (school_id, username, employee_id, full_name, phone, password_hash, role, account_status, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, \'active\', 1)'
            );
            $stmt->execute([$schoolId, $username, $employeeId, $fullName, $phone, $passwordHash, $role]);
        }

        return (int)Database::connection()->lastInsertId();
    }

    public function updateProfile(
        int $userId,
        string $fullName,
        string $role,
        bool $isActive,
        string $username,
        ?string $employeeId = null,
        ?string $phone = null,
        ?int $schoolId = null
    ): void {
        $sql = "UPDATE users
                SET username = ?,
                    employee_id = ?,
                    full_name = ?,
                    phone = ?,
                    role = ?,
                    account_status = CASE WHEN ? = 1 THEN 'active' ELSE 'deactivated' END,
                    is_active = ?,
                    session_version = session_version + 1
                WHERE id = ?";
        $activeValue = $isActive ? 1 : 0;
        $params = [$username, $employeeId, $fullName, $phone, $role, $activeValue, $activeValue, $userId];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' AND school_id = ?';
            $params[] = $schoolId;
        }

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
    }

    public function findTeacherByEmployeeIdForUpdate(string $employeeId, int $schoolId): ?array
    {
        $stmt = Database::connection()->prepare(
            "SELECT id, school_id, username, employee_id, full_name, phone, password_hash,
                    role, account_status, is_active, session_version
             FROM users
             WHERE employee_id = ? AND school_id = ? AND role = 'teacher'
             LIMIT 1 FOR UPDATE"
        );
        $stmt->execute([$employeeId, $schoolId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function createPendingTeacher(
        int $schoolId,
        string $username,
        string $fullName,
        ?string $employeeId,
        ?string $phone
    ): int {
        $this->assertSchoolId($schoolId);
        $stmt = Database::connection()->prepare(
            "INSERT INTO users
                (school_id, username, employee_id, full_name, phone, password_hash,
                 role, account_status, is_active)
             VALUES (?, ?, ?, ?, ?, NULL, 'teacher', 'deactivated', 0)"
        );
        $stmt->execute([$schoolId, $username, $employeeId, $fullName, $phone]);
        return (int)Database::connection()->lastInsertId();
    }

    public function activateFromOnboarding(
        int $userId,
        string $passwordHash,
        int $schoolId
    ): int {
        $this->assertSchoolId($schoolId);
        $stmt = Database::connection()->prepare(
            "UPDATE users
             SET password_hash = ?,
                 account_status = 'active',
                 is_active = 1,
                 failed_login_attempts = 0,
                 locked_until = NULL,
                 session_version = session_version + 1
             WHERE id = ? AND school_id = ? AND role = 'teacher'"
        );
        $stmt->execute([$passwordHash, $userId, $schoolId]);
        if ($stmt->rowCount() !== 1) {
            throw new \InvalidArgumentException('Teacher account not found in the authenticated school.');
        }

        $version = Database::connection()->prepare(
            'SELECT session_version FROM users WHERE id = ? AND school_id = ? LIMIT 1'
        );
        $version->execute([$userId, $schoolId]);
        return (int)$version->fetchColumn();
    }

    public function bumpSessionVersion(int $userId, int $schoolId): int
    {
        $this->assertSchoolId($schoolId);
        $stmt = Database::connection()->prepare(
            'UPDATE users
             SET session_version = session_version + 1
             WHERE id = ? AND school_id = ?'
        );
        $stmt->execute([$userId, $schoolId]);

        if ($stmt->rowCount() !== 1) {
            throw new \InvalidArgumentException('User not found in the authenticated school.');
        }

        $version = Database::connection()->prepare(
            'SELECT session_version FROM users WHERE id = ? AND school_id = ? LIMIT 1'
        );
        $version->execute([$userId, $schoolId]);
        return (int)$version->fetchColumn();
    }

    public function updatePasswordHash(int $userId, string $passwordHash, ?int $schoolId = null): void
    {
        $sql = 'UPDATE users
                SET password_hash = ?,
                    failed_login_attempts = 0,
                    locked_until = NULL,
                    session_version = session_version + 1
                WHERE id = ?';
        $params = [$passwordHash, $userId];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' AND school_id = ?';
            $params[] = $schoolId;
        }

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
    }

    public function unlock(int $userId, ?int $schoolId = null): void
    {
        $sql = 'UPDATE users
                SET failed_login_attempts = 0,
                    locked_until = NULL,
                    session_version = session_version + 1
                WHERE id = ?';
        $params = [$userId];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' AND school_id = ?';
            $params[] = $schoolId;
        }

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
    }

    public function findSecurityById(int $userId): ?array
    {
        $stmt = Database::connection()->prepare(
            "SELECT id, school_id, password_hash, session_version, account_status
             FROM users
             WHERE id = ? AND is_active = 1 AND account_status = 'active'
             LIMIT 1"
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
            'UPDATE users
             SET failed_login_attempts = 0,
                 locked_until = NULL,
                 last_login_at = CURRENT_TIMESTAMP,
                 last_seen_at = CURRENT_TIMESTAMP
             WHERE id = ?'
        );
        $stmt->execute([$userId]);
    }

    public function touchPresence(int $userId): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ? AND is_active = 1'
        );
        $stmt->execute([$userId]);
    }

    public function clearPresence(int $userId): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE users SET last_seen_at = NULL WHERE id = ?'
        );
        $stmt->execute([$userId]);
    }

    public function countActiveAdmins(): int
    {
        return (int)Database::connection()->query(
            'SELECT COUNT(*) FROM users WHERE role = \'admin\' AND is_active = 1'
        )->fetchColumn();
    }

    private function assertSchoolId(int $schoolId): void
    {
        if ($schoolId < 1) {
            throw new \InvalidArgumentException('Invalid school.');
        }
    }
}