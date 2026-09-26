<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class AttendanceSignoffRepository
{
    public function forWeek(int $classId, string $start, string $end): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                s.id,
                s.class_id,
                s.teacher_id,
                u.full_name AS teacher_name,
                u.employee_id,
                s.attendance_date,
                s.period,
                s.status,
                s.signed_at,
                s.invalidated_at
             FROM attendance_signoffs s
             INNER JOIN users u ON u.id = s.teacher_id
             WHERE s.class_id = ?
               AND s.attendance_date BETWEEN ? AND ?
             ORDER BY s.attendance_date, s.period'
        );
        $stmt->execute([$classId, $start, $end]);
        return $stmt->fetchAll();
    }

    public function weekSignatures(int $classId, string $weekStart): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                s.id,
                s.class_id,
                s.teacher_id,
                u.full_name AS teacher_name,
                u.employee_id,
                s.week_start,
                s.status,
                s.signed_at,
                s.invalidated_at,
                s.signature_data
             FROM attendance_week_signatures s
             INNER JOIN users u ON u.id = s.teacher_id
             WHERE s.class_id = ? AND s.week_start = ?
             ORDER BY u.full_name, s.teacher_id'
        );
        $stmt->execute([$classId, $weekStart]);
        return $stmt->fetchAll();
    }

    public function teachersForClass(int $classId): array
    {
        $stmt = Database::connection()->prepare(
            "SELECT DISTINCT u.id, u.full_name, u.employee_id
             FROM users u
             INNER JOIN teacher_classes tc ON tc.teacher_id = u.id
             WHERE tc.class_id = ? AND u.role = 'teacher' AND u.is_active = 1
             ORDER BY u.full_name, u.employee_id, u.id"
        );
        $stmt->execute([$classId]);
        return $stmt->fetchAll();
    }

    public function subjectsForClassTeachers(int $classId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                tt.teacher_id,
                s.id AS subject_id,
                s.code AS subject_code,
                s.name_fr AS subject_name_fr,
                s.name_ar AS subject_name_ar,
                s.name_en AS subject_name_en
             FROM teacher_teachings tt
             INNER JOIN subjects s ON s.id = tt.subject_id
             WHERE tt.class_id = ?
             ORDER BY tt.teacher_id, s.name_fr, s.id'
        );
        $stmt->execute([$classId]);
        return $stmt->fetchAll();
    }

    public function findPeriod(int $classId, string $date, int $period): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, teacher_id, status, signed_at, invalidated_at
             FROM attendance_signoffs
             WHERE class_id = ? AND attendance_date = ? AND period = ?
             LIMIT 1'
        );
        $stmt->execute([$classId, $date, $period]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findWeekSignature(int $classId, int $teacherId, string $weekStart): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, teacher_id, status, signed_at, invalidated_at
             FROM attendance_week_signatures
             WHERE class_id = ? AND teacher_id = ? AND week_start = ?
             LIMIT 1'
        );
        $stmt->execute([$classId, $teacherId, $weekStart]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function countTeacherPeriodSignoffs(int $classId, int $teacherId, string $start, string $end): array
    {
        $stmt = Database::connection()->prepare(
            "SELECT
                SUM(CASE WHEN status = 'signed' THEN 1 ELSE 0 END) AS signed_lessons,
                SUM(CASE WHEN status = 'needs_resign' THEN 1 ELSE 0 END) AS needs_resign
             FROM attendance_signoffs
             WHERE class_id = ? AND teacher_id = ? AND attendance_date BETWEEN ? AND ?"
        );
        $stmt->execute([$classId, $teacherId, $start, $end]);
        return $stmt->fetch() ?: ['signed_lessons' => 0, 'needs_resign' => 0];
    }

    public function findSubmission(int $classId, string $weekStart): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                s.id,
                s.class_id,
                s.week_start,
                s.received_by,
                u.full_name AS received_by_name,
                s.received_at
             FROM attendance_week_submissions s
             INNER JOIN users u ON u.id = s.received_by
             WHERE s.class_id = ? AND s.week_start = ?
             LIMIT 1'
        );
        $stmt->execute([$classId, $weekStart]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function receiveWeek(int $classId, string $weekStart, int $adminId): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO attendance_week_submissions (class_id, week_start, received_by)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE
                received_by = VALUES(received_by),
                received_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([$classId, $weekStart, $adminId]);
        return (int)Database::connection()->lastInsertId();
    }

    public function clearSubmission(int $classId, string $weekStart): ?array
    {
        $existing = $this->findSubmission($classId, $weekStart);
        if ($existing === null) return null;

        $stmt = Database::connection()->prepare(
            'DELETE FROM attendance_week_submissions WHERE class_id = ? AND week_start = ?'
        );
        $stmt->execute([$classId, $weekStart]);
        return $existing;
    }

    public function upsertPeriod(
        int $classId,
        int $teacherId,
        string $date,
        int $period,
        string $signatureData
    ): void {
        $stmt = Database::connection()->prepare(
            'INSERT INTO attendance_signoffs
                (class_id, teacher_id, attendance_date, period, signature_data, status, signed_at, invalidated_at, invalidated_by)
             VALUES (?, ?, ?, ?, ?, "signed", CURRENT_TIMESTAMP, NULL, NULL)
             ON DUPLICATE KEY UPDATE
                teacher_id = VALUES(teacher_id),
                signature_data = VALUES(signature_data),
                status = "signed",
                signed_at = CURRENT_TIMESTAMP,
                invalidated_at = NULL,
                invalidated_by = NULL'
        );
        $stmt->execute([$classId, $teacherId, $date, $period, $signatureData]);
    }

    public function upsertWeekSignature(
        int $classId,
        int $teacherId,
        string $weekStart,
        string $signatureData
    ): void {
        $stmt = Database::connection()->prepare(
            'INSERT INTO attendance_week_signatures
                (class_id, teacher_id, week_start, signature_data, status, signed_at, invalidated_at, invalidated_by)
             VALUES (?, ?, ?, ?, "signed", CURRENT_TIMESTAMP, NULL, NULL)
             ON DUPLICATE KEY UPDATE
                signature_data = VALUES(signature_data),
                status = "signed",
                signed_at = CURRENT_TIMESTAMP,
                invalidated_at = NULL,
                invalidated_by = NULL'
        );
        $stmt->execute([$classId, $teacherId, $weekStart, $signatureData]);
    }

    public function invalidatePeriod(int $classId, string $date, int $period, int $userId): int
    {
        $stmt = Database::connection()->prepare(
            'UPDATE attendance_signoffs
             SET status = "needs_resign", invalidated_at = CURRENT_TIMESTAMP, invalidated_by = ?
             WHERE class_id = ? AND attendance_date = ? AND period = ? AND status = "signed"'
        );
        $stmt->execute([$userId, $classId, $date, $period]);
        return $stmt->rowCount();
    }

    public function invalidateWeekSignature(int $classId, string $weekStart, int $userId): int
    {
        $stmt = Database::connection()->prepare(
            'UPDATE attendance_week_signatures
             SET status = "needs_resign", invalidated_at = CURRENT_TIMESTAMP, invalidated_by = ?
             WHERE class_id = ? AND week_start = ? AND status = "signed"'
        );
        $stmt->execute([$userId, $classId, $weekStart]);
        return $stmt->rowCount();
    }

    public function reopenPeriod(int $classId, string $date, int $period, int $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE attendance_signoffs
             SET status = "needs_resign", invalidated_at = CURRENT_TIMESTAMP, invalidated_by = ?
             WHERE class_id = ? AND attendance_date = ? AND period = ? AND status = "signed"'
        );
        $stmt->execute([$userId, $classId, $date, $period]);
        return $stmt->rowCount() > 0;
    }
}
