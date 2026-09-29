<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class OnboardingRepository
{
    public function revokeActiveCodesForSchool(int $schoolId): int
    {
        $stmt = Database::connection()->prepare(
            'UPDATE school_onboarding_codes
             SET revoked_at = CURRENT_TIMESTAMP
             WHERE school_id = ? AND revoked_at IS NULL
               AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)'
        );
        $stmt->execute([$schoolId]);
        return $stmt->rowCount();
    }

    public function createCode(
        int $schoolId,
        string $codeHash,
        ?int $createdBy,
        ?string $expiresAt
    ): int {
        $stmt = Database::connection()->prepare(
            'INSERT INTO school_onboarding_codes
                (school_id, code_hash, created_by, expires_at)
             VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$schoolId, $codeHash, $createdBy, $expiresAt]);
        return (int)Database::connection()->lastInsertId();
    }

    public function findActiveCodeByHashForUpdate(string $codeHash): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, school_id, code_hash, expires_at, revoked_at
             FROM school_onboarding_codes
             WHERE code_hash = ?
               AND revoked_at IS NULL
               AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
             LIMIT 1
             FOR UPDATE'
        );
        $stmt->execute([$codeHash]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function createRequest(
        int $schoolId,
        int $onboardingCodeId,
        string $requestTokenHash,
        string $fullName,
        ?string $employeeId,
        ?string $phone,
        string $expiresAt,
        string $requestIp,
        string $requestUserAgent
    ): int {
        $stmt = Database::connection()->prepare(
            'INSERT INTO teacher_onboarding_requests
                (school_id, onboarding_code_id, request_token_hash, full_name,
                 employee_id, phone, request_ip, request_user_agent, status, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, \'pending\', ?)'
        );
        $stmt->execute([
            $schoolId,
            $onboardingCodeId,
            $requestTokenHash,
            $fullName,
            $employeeId,
            $phone,
            $requestIp,
            $requestUserAgent,
            $expiresAt,
        ]);

        return (int)Database::connection()->lastInsertId();
    }

    public function countRecentRequestsByIp(
        string $requestIp,
        int $minutes = 15
    ): int {
        $minutes = max(1, min(60, $minutes));
        $cutoff = gmdate('Y-m-d H:i:s', time() - ($minutes * 60));
        $stmt = Database::connection()->prepare(
            'SELECT COUNT(*)
             FROM teacher_onboarding_requests
             WHERE request_ip = ?
               AND created_at >= ?'
        );
        $stmt->execute([$requestIp, $cutoff]);
        return (int)$stmt->fetchColumn();
    }

    public function findRequestByTokenForUpdate(string $tokenHash): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, school_id, onboarding_code_id, request_token_hash,
                    full_name, employee_id, phone, request_ip, request_user_agent,
                    status, expires_at, reviewed_by, reviewed_at,
                    rejection_reason, created_user_id, created_at, updated_at
             FROM teacher_onboarding_requests
             WHERE request_token_hash = ?
             LIMIT 1
             FOR UPDATE'
        );
        $stmt->execute([$tokenHash]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findRequestByIdForUpdate(int $requestId, int $schoolId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, school_id, onboarding_code_id, request_token_hash,
                    full_name, employee_id, phone, request_ip, request_user_agent,
                    status, expires_at, reviewed_by, reviewed_at,
                    rejection_reason, created_user_id, created_at, updated_at
             FROM teacher_onboarding_requests
             WHERE id = ? AND school_id = ?
             LIMIT 1
             FOR UPDATE'
        );
        $stmt->execute([$requestId, $schoolId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function listRequests(int $schoolId, ?string $status = null): array
    {
        $sql = 'SELECT id, school_id, full_name, employee_id, phone, status,
                       expires_at, reviewed_by, reviewed_at, rejection_reason,
                       created_user_id, created_at, updated_at
                FROM teacher_onboarding_requests
                WHERE school_id = ?';
        $params = [$schoolId];
        if ($status !== null) {
            $sql .= ' AND status = ?';
            $params[] = $status;
        }
        $sql .= ' ORDER BY created_at DESC, id DESC';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function approveRequest(
        int $requestId,
        int $schoolId,
        int $reviewedBy,
        int $createdUserId
    ): void {
        $stmt = Database::connection()->prepare(
            "UPDATE teacher_onboarding_requests
             SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
                 rejection_reason = NULL, created_user_id = ?
             WHERE id = ? AND school_id = ? AND status = 'pending'"
        );
        $stmt->execute([$reviewedBy, $createdUserId, $requestId, $schoolId]);
        if ($stmt->rowCount() !== 1) {
            throw new \RuntimeException('Onboarding request state changed unexpectedly.');
        }
    }

    public function rejectRequest(
        int $requestId,
        int $schoolId,
        int $reviewedBy,
        ?string $reason
    ): void {
        $stmt = Database::connection()->prepare(
            "UPDATE teacher_onboarding_requests
             SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
                 rejection_reason = ?
             WHERE id = ? AND school_id = ? AND status = 'pending'"
        );
        $stmt->execute([$reviewedBy, $reason, $requestId, $schoolId]);
        if ($stmt->rowCount() !== 1) {
            throw new \RuntimeException('Onboarding request state changed unexpectedly.');
        }
    }

    public function markExpired(int $requestId, int $schoolId): void
    {
        $stmt = Database::connection()->prepare(
            "UPDATE teacher_onboarding_requests
             SET status = 'expired'
             WHERE id = ? AND school_id = ? AND status = 'pending'
               AND expires_at <= CURRENT_TIMESTAMP"
        );
        $stmt->execute([$requestId, $schoolId]);
    }
}
