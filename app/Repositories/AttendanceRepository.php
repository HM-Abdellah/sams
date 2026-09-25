<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class AttendanceRepository
{
    public function forClassMonth(int $classId, string $month): array
    {
        $startDate = new \DateTimeImmutable($month . '-01');
        return $this->forClassRange(
            $classId,
            $startDate->format('Y-m-d'),
            $startDate->format('Y-m-t')
        );
    }

    public function forClassRange(int $classId, string $start, string $end): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                a.id,
                a.student_id,
                a.enrollment_id,
                a.attendance_date,
                a.period,
                a.status,
                a.recorded_by,
                a.updated_at
             FROM attendance a
             INNER JOIN student_enrollments e ON e.id = a.enrollment_id
             WHERE e.class_id = ?
               AND a.attendance_date BETWEEN ? AND ?
             ORDER BY a.attendance_date, a.period, a.student_id'
        );
        $stmt->execute([$classId, $start, $end]);
        return $stmt->fetchAll();
    }

    public function find(int $enrollmentId, string $date, int $period): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                id,
                student_id,
                enrollment_id,
                attendance_date,
                period,
                status,
                recorded_by,
                created_at,
                updated_at
             FROM attendance
             WHERE enrollment_id = ?
               AND attendance_date = ?
               AND period = ?
             LIMIT 1'
        );
        $stmt->execute([$enrollmentId, $date, $period]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function upsert(
        int $studentId,
        int $enrollmentId,
        string $date,
        int $period,
        string $status,
        int $recordedBy
    ): void {
        $stmt = Database::connection()->prepare(
            'INSERT INTO attendance
                (student_id, enrollment_id, attendance_date, period, status, recorded_by)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 status = VALUES(status),
                 recorded_by = VALUES(recorded_by),
                 updated_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([
            $studentId,
            $enrollmentId,
            $date,
            $period,
            $status,
            $recordedBy,
        ]);
    }

    public function delete(int $enrollmentId, string $date, int $period): void
    {
        $stmt = Database::connection()->prepare(
            'DELETE FROM attendance
             WHERE enrollment_id = ? AND attendance_date = ? AND period = ?'
        );
        $stmt->execute([$enrollmentId, $date, $period]);
    }

    public function allForClass(int $classId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                a.student_id,
                a.enrollment_id,
                a.attendance_date,
                a.period,
                a.status
             FROM attendance a
             INNER JOIN student_enrollments e ON e.id = a.enrollment_id
             WHERE e.class_id = ?
             ORDER BY a.attendance_date, a.period, a.student_id'
        );
        $stmt->execute([$classId]);
        return $stmt->fetchAll();
    }
}
