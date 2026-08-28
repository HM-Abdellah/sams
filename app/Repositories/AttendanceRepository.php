<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;
use PDO;

final class AttendanceRepository
{
    public function forClassMonth(int $classId, string $month): array
    {
        $start = $month . '-01';
        $end = date('Y-m-t', strtotime($start));
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

    public function upsert(int $studentId, string $date, int $period, string $status, int $recordedBy): void
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO attendance (student_id, attendance_date, period, status, recorded_by)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status), recorded_by = VALUES(recorded_by), updated_at = CURRENT_TIMESTAMP'
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
             FROM attendance a INNER JOIN students s ON s.id = a.student_id
             WHERE s.class_id = ? ORDER BY a.attendance_date, a.period'
        );
        $stmt->execute([$classId]);
        return $stmt->fetchAll();
    }
}
