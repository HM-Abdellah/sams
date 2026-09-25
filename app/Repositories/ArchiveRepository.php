<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class ArchiveRepository
{
    public function classInfo(int $classId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                c.id,
                c.name,
                c.level,
                c.branch,
                c.is_active,
                c.academic_year_id,
                ay.name AS academic_year_name,
                ay.starts_on AS academic_year_starts_on,
                ay.ends_on AS academic_year_ends_on
             FROM classes c
             INNER JOIN academic_years ay ON ay.id = c.academic_year_id
             WHERE c.id = ?
             LIMIT 1'
        );
        $stmt->execute([$classId]);

        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function days(int $classId, string $start, string $end): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                a.attendance_date,
                COUNT(*) AS recorded_count,
                SUM(a.status = 'present') AS present_count,
                SUM(a.status = 'absent') AS absent_count,
                SUM(a.status = 'late') AS late_count,
                SUM(a.status = 'excused') AS excused_count,
                COUNT(DISTINCT a.student_id) AS students_with_records
             FROM attendance a
             INNER JOIN student_enrollments e ON e.id = a.enrollment_id
             WHERE e.class_id = ?
               AND a.attendance_date BETWEEN ? AND ?
             GROUP BY a.attendance_date
             ORDER BY a.attendance_date DESC'
        );
        $stmt->execute([$classId, $start, $end]);

        return $stmt->fetchAll();
    }

    public function monthlyStudents(int $classId, string $start, string $end): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                s.id,
                s.student_number,
                s.massar_code,
                s.first_name,
                s.last_name,
                s.birth_date,
                e.starts_on AS enrollment_starts_on,
                e.ends_on AS enrollment_ends_on,
                COALESCE(SUM(a.status = 'present'), 0) AS present_count,
                COALESCE(SUM(a.status = 'absent'), 0) AS absent_count,
                COALESCE(SUM(a.status = 'late'), 0) AS late_count,
                COALESCE(SUM(a.status = 'excused'), 0) AS excused_count,
                COUNT(a.id) AS recorded_count,
                COUNT(DISTINCT a.attendance_date) AS recorded_days
             FROM student_enrollments e
             INNER JOIN students s ON s.id = e.student_id
             LEFT JOIN attendance a
                ON a.enrollment_id = e.id
               AND a.attendance_date BETWEEN ? AND ?
             WHERE e.class_id = ?
               AND e.starts_on <= ?
               AND (e.ends_on IS NULL OR e.ends_on >= ?)
             GROUP BY
                s.id,
                s.student_number,
                s.massar_code,
                s.first_name,
                s.last_name,
                s.birth_date,
                e.starts_on,
                e.ends_on
             ORDER BY s.last_name, s.first_name, s.id'
        );
        $stmt->execute([$start, $end, $classId, $end, $start]);

        return $stmt->fetchAll();
    }

    public function daily(int $classId, string $date): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                s.id AS student_id,
                s.student_number,
                s.massar_code,
                s.first_name,
                s.last_name,
                s.birth_date,
                e.id AS enrollment_id,
                e.starts_on AS enrollment_starts_on,
                e.ends_on AS enrollment_ends_on,
                a.id AS attendance_id,
                a.attendance_date,
                a.period,
                a.status,
                a.recorded_by,
                a.created_at,
                a.updated_at
             FROM student_enrollments e
             INNER JOIN students s ON s.id = e.student_id
             LEFT JOIN attendance a
                ON a.enrollment_id = e.id
               AND a.attendance_date = ?
             WHERE e.class_id = ?
               AND e.starts_on <= ?
               AND (e.ends_on IS NULL OR e.ends_on >= ?)
             ORDER BY s.last_name, s.first_name, s.id, a.period'
        );
        $stmt->execute([$date, $classId, $date, $date]);

        return $stmt->fetchAll();
    }

    public function studentInClass(int $studentId, int $classId): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT 1
             FROM student_enrollments
             WHERE student_id = ? AND class_id = ?
             LIMIT 1'
        );
        $stmt->execute([$studentId, $classId]);

        return (bool)$stmt->fetchColumn();
    }

    public function studentHistory(
        int $studentId,
        int $classId
    ): array {
        $stmt = Database::connection()->prepare(
            'SELECT
                s.id AS student_id,
                s.student_number,
                s.massar_code,
                s.first_name,
                s.last_name,
                s.birth_date,
                e.id AS enrollment_id,
                e.class_id,
                c.name AS class_name,
                ay.id AS academic_year_id,
                ay.name AS academic_year_name,
                e.starts_on,
                e.ends_on,
                a.id AS attendance_id,
                a.attendance_date,
                a.period,
                a.status,
                a.recorded_by,
                a.created_at,
                a.updated_at
             FROM student_enrollments e
             INNER JOIN students s ON s.id = e.student_id
             INNER JOIN classes c ON c.id = e.class_id
             INNER JOIN academic_years ay ON ay.id = c.academic_year_id
             LEFT JOIN attendance a ON a.enrollment_id = e.id
             WHERE e.student_id = ?
               AND e.class_id = ?
             ORDER BY a.attendance_date DESC, a.period DESC, e.starts_on DESC, e.id DESC'
        );
        $stmt->execute([$studentId, $classId]);

        return $stmt->fetchAll();
    }
}
