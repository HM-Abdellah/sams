<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class LoginCodeRepository
{
    public function findUserByCodeHashForUpdate(string $codeHash): ?array
    {
        $stmt = Database::connection()->prepare(
            "SELECT u.id, u.school_id, u.username, u.employee_id, u.full_name, u.phone,
                    u.phone_verified, u.password_hash, u.role, u.account_status, u.is_active,
                    u.failed_login_attempts, u.locked_until, u.session_version,
                    u.last_login_at, u.last_seen_at
             FROM sams_login_codes lc
             INNER JOIN users u ON u.id = lc.user_id
             WHERE lc.code_hash = ?
               AND lc.revoked_at IS NULL
             LIMIT 1
             FOR UPDATE"
        );
        $stmt->execute([$codeHash]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function revokeActiveForUser(int $userId, int $schoolId): int
    {
        $stmt = Database::connection()->prepare(
            "UPDATE sams_login_codes lc
             INNER JOIN users u ON u.id = lc.user_id
             SET lc.revoked_at = CURRENT_TIMESTAMP
             WHERE lc.user_id = ? AND u.school_id = ? AND lc.revoked_at IS NULL"
        );
        $stmt->execute([$userId, $schoolId]);
        return $stmt->rowCount();
    }

    public function create(
        int $userId,
        string $codeHash,
        ?int $issuedBy,
        int $schoolId
    ): int {
        $stmt = Database::connection()->prepare(
            "INSERT INTO sams_login_codes (user_id, code_hash, issued_by)
             SELECT u.id, ?, ?
             FROM users u
             WHERE u.id = ? AND u.school_id = ?
             LIMIT 1"
        );
        $stmt->execute([$codeHash, $issuedBy, $userId, $schoolId]);

        if ($stmt->rowCount() !== 1) {
            throw new \InvalidArgumentException('User not found in the authenticated school.');
        }

        return (int)Database::connection()->lastInsertId();
    }
}
