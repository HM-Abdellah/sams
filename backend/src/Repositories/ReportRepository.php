<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class ReportRepository
{
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
                COALESCE(SUM(a.status = \'present\'), 0) AS present_count,
                COALESCE(SUM(a.status = \'absent\'), 0) AS absent_count,
                COALESCE(SUM(a.status = \'late\'), 0) AS late_count,
                COALESCE(SUM(a.status = \'excused\'), 0) AS excused_count,
                COALESCE(SUM(a.status IN (\'late\', \'excused\')), 0) AS other_count,
                COUNT(a.id) AS recorded_count
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
                s.birth_date
             ORDER BY s.last_name, s.first_name, s.id'
        );
        $stmt->execute([$start, $end, $classId, $end, $start]);
        return $stmt->fetchAll();
    }
}