<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class AttendanceRepository
{
    public function forClassMonth(int $classId, string $month): array
    {
        $startDate = new \DateTimeImmutable($month . '-01');
        $start = $startDate->format('Y-m-d');
        $end = $startDate->format('Y-m-t');

        $stmt = Database::connection()->prepare(
            'SELECT a.student_id, a.attendance_date, a.period, a.status, a.recorded_by, a.updated_at
             FROM attendance a
             INNER JOIN students s ON s.id = a.student_id
             WHERE s.class_id = ? AND s.status = \'active\' AND a.attendance_date BETWEEN ? AND ?
             ORDER BY a.attendance_date, a.period, a.student_id'
        );
        $stmt->execute([$classId, $start, $end]);
        return $stmt->fetchAll();
    }

    public function forClassRange(int $classId, string $start, string $end): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT a.id, a.student_id, a.attendance_date, a.period, a.status, a.recorded_by, a.updated_at
             FROM attendance a
             INNER JOIN students s ON s.id = a.student_id
             WHERE s.class_id = ? AND a.attendance_date BETWEEN ? AND ?
             ORDER BY a.attendance_date, a.period, a.student_id'
        );
        $stmt->execute([$classId, $start, $end]);
        return $stmt->fetchAll();
    }

    public function find(int $studentId, string $date, int $period): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, student_id, attendance_date, period, status, recorded_by, created_at, updated_at
             FROM attendance
             WHERE student_id = ? AND attendance_date = ? AND period = ?
             LIMIT 1'
        );
        $stmt->execute([$studentId, $date, $period]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function upsert(int $studentId, string $date, int $period, string $status, int $recordedBy): void
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO attendance (student_id, attendance_date, period, status, recorded_by)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 status = VALUES(status),
                 recorded_by = VALUES(recorded_by),
                 updated_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([$studentId, $date, $period, $status, $recordedBy]);
    }

    public function delete(int $studentId, string $date, int $period): void
    {
        $stmt = Database::connection()->prepare(
            'DELETE FROM attendance WHERE student_id = ? AND attendance_date = ? AND period = ?'
        );
        $stmt->execute([$studentId, $date, $period]);
    }

    public function allForClass(int $classId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT a.student_id, a.attendance_date, a.period, a.status
             FROM attendance a
             INNER JOIN students s ON s.id = a.student_id
             WHERE s.class_id = ?
             ORDER BY a.attendance_date, a.period'
        );
        $stmt->execute([$classId]);
        return $stmt->fetchAll();
    }
}
