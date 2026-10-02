<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class AdminDashboardRepository
{
    public const ABSENCE_ALERT_THRESHOLD = 5;

    public function summary(?int $schoolId = null): array
    {
        $schoolId = $this->normalizeSchoolId($schoolId);
        $yearScope = $schoolId === null ? '' : ' AND ay.school_id = ' . $schoolId;
        $userScope = $schoolId === null ? '' : ' AND school_id = ' . $schoolId;
        $pdo = Database::connection();
        $summary = $pdo->query(
            "SELECT
                (SELECT COUNT(*)
                 FROM classes c
                 INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                 WHERE c.is_active = 1 AND ay.is_active = 1{$yearScope}) AS active_classes,
                (SELECT COUNT(DISTINCT e.student_id)
                 FROM student_enrollments e
                 INNER JOIN classes c ON c.id = e.class_id
                 INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                 INNER JOIN students s ON s.id = e.student_id
                 WHERE c.is_active = 1 AND ay.is_active = 1{$yearScope}
                   AND s.status = 'active'
                   AND e.starts_on <= CURDATE()
                   AND (e.ends_on IS NULL OR e.ends_on >= CURDATE())) AS active_students,
                (SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = 1{$userScope}) AS active_teachers,
                (SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = 1 AND last_seen_at >= CURRENT_TIMESTAMP - INTERVAL 90 SECOND{$userScope}) AS online_teachers,
                (SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = 1 AND phone_verified = 0{$userScope}) AS unverified_teachers,
                (SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = 1 AND locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP{$userScope}) AS locked_teachers,
                (SELECT COUNT(*)
                 FROM attendance a
                 INNER JOIN student_enrollments e ON e.id = a.enrollment_id
                 INNER JOIN classes c ON c.id = e.class_id
                 INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                 WHERE c.is_active = 1 AND ay.is_active = 1{$yearScope} AND a.attendance_date = CURDATE()) AS today_records,
                (SELECT COALESCE(SUM(a.status = 'present'), 0)
                 FROM attendance a
                 INNER JOIN student_enrollments e ON e.id = a.enrollment_id
                 INNER JOIN classes c ON c.id = e.class_id
                 INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                 WHERE c.is_active = 1 AND ay.is_active = 1{$yearScope} AND a.attendance_date = CURDATE()) AS today_present,
                (SELECT COALESCE(SUM(a.status = 'absent'), 0)
                 FROM attendance a
                 INNER JOIN student_enrollments e ON e.id = a.enrollment_id
                 INNER JOIN classes c ON c.id = e.class_id
                 INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                 WHERE c.is_active = 1 AND ay.is_active = 1{$yearScope} AND a.attendance_date = CURDATE()) AS today_absent,
                (SELECT COALESCE(SUM(a.status = 'late'), 0)
                 FROM attendance a
                 INNER JOIN student_enrollments e ON e.id = a.enrollment_id
                 INNER JOIN classes c ON c.id = e.class_id
                 INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                 WHERE c.is_active = 1 AND ay.is_active = 1{$yearScope} AND a.attendance_date = CURDATE()) AS today_late,
                (SELECT COALESCE(SUM(a.status = 'excused'), 0)
                 FROM attendance a
                 INNER JOIN student_enrollments e ON e.id = a.enrollment_id
                 INNER JOIN classes c ON c.id = e.class_id
                 INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                 WHERE c.is_active = 1 AND ay.is_active = 1{$yearScope} AND a.attendance_date = CURDATE()) AS today_excused"
        )->fetch();

        return $summary ?: [];
    }

    public function classStats(?int $schoolId = null): array
    {
        $schoolId = $this->normalizeSchoolId($schoolId);
        $yearScope = $schoolId === null ? '' : ' AND ay.school_id = ' . $schoolId;
        return Database::connection()->query(
            "SELECT
                c.id,
                c.name,
                c.level,
                c.branch,
                ay.id AS academic_year_id,
                ay.name AS academic_year_name,
                COUNT(DISTINCT CASE WHEN e.starts_on <= CURDATE() AND (e.ends_on IS NULL OR e.ends_on >= CURDATE()) AND s.status = 'active' THEN s.id END) AS student_count,
                COUNT(a.id) AS today_records,
                COALESCE(SUM(a.status = 'present'), 0) AS present_count,
                COALESCE(SUM(a.status = 'absent'), 0) AS absent_count,
                COALESCE(SUM(a.status = 'late'), 0) AS late_count,
                COALESCE(SUM(a.status = 'excused'), 0) AS excused_count
             FROM classes c
             INNER JOIN academic_years ay ON ay.id = c.academic_year_id
             LEFT JOIN student_enrollments e ON e.class_id = c.id
                AND e.starts_on <= CURDATE()
                AND (e.ends_on IS NULL OR e.ends_on >= CURDATE())
             LEFT JOIN students s ON s.id = e.student_id
             LEFT JOIN attendance a ON a.enrollment_id = e.id AND a.attendance_date = CURDATE()
             WHERE c.is_active = 1 AND ay.is_active = 1{$yearScope}
             GROUP BY c.id, c.name, c.level, c.branch, ay.id, ay.name
             ORDER BY c.branch, c.level, c.name, c.id"
        )->fetchAll();
    }

    public function attentionStudents(?int $schoolId = null): array
    {
        $schoolId = $this->normalizeSchoolId($schoolId);
        $yearScope = $schoolId === null ? '' : ' AND current_year.school_id = ' . $schoolId;
        $threshold = self::ABSENCE_ALERT_THRESHOLD;
        $stmt = Database::connection()->query(
            "SELECT
                s.id,
                s.first_name,
                s.last_name,
                current_class.id AS class_id,
                current_class.name AS class_name,
                current_class.level AS class_level,
                current_class.branch AS class_branch,
                COALESCE(SUM(a.status = 'absent'), 0) AS absent_count,
                COALESCE(SUM(a.status = 'late'), 0) AS late_count
             FROM students s
             INNER JOIN student_enrollments current_enrollment
                ON current_enrollment.student_id = s.id
               AND current_enrollment.starts_on <= CURDATE()
               AND (current_enrollment.ends_on IS NULL OR current_enrollment.ends_on >= CURDATE())
             INNER JOIN classes current_class
                ON current_class.id = current_enrollment.class_id
             INNER JOIN academic_years current_year
                ON current_year.id = current_class.academic_year_id
               AND current_year.is_active = 1{$yearScope}
             LEFT JOIN student_enrollments e
                ON e.student_id = s.id
               AND e.starts_on <= CURDATE()
             LEFT JOIN attendance a
                ON a.enrollment_id = e.id
               AND a.attendance_date BETWEEN current_year.starts_on AND LEAST(current_year.ends_on, CURDATE())
             WHERE s.status = 'active'
               AND current_class.is_active = 1
               AND (e.ends_on IS NULL OR e.ends_on >= current_year.starts_on)
             GROUP BY s.id, s.first_name, s.last_name,
                      current_class.id, current_class.name, current_class.level, current_class.branch
             HAVING absent_count >= {$threshold}
             ORDER BY absent_count DESC, late_count DESC, s.last_name, s.first_name
             LIMIT 10"
        );
        return $stmt->fetchAll();
    }

    public function classesWithoutTodayRecords(?int $schoolId = null): array
    {
        $schoolId = $this->normalizeSchoolId($schoolId);
        $yearScope = $schoolId === null ? '' : ' AND ay.school_id = ' . $schoolId;
        return Database::connection()->query(
            "SELECT c.id, c.name, c.level, c.branch, ay.name AS academic_year_name
             FROM classes c
             INNER JOIN academic_years ay ON ay.id = c.academic_year_id
             WHERE c.is_active = 1
               AND ay.is_active = 1{$yearScope}
               AND EXISTS (
                   SELECT 1
                   FROM student_enrollments e
                   INNER JOIN students s ON s.id = e.student_id
                   WHERE e.class_id = c.id
                     AND e.starts_on <= CURDATE()
                     AND (e.ends_on IS NULL OR e.ends_on >= CURDATE())
                     AND s.status = 'active'
               )
               AND NOT EXISTS (
                   SELECT 1
                   FROM attendance a
                   INNER JOIN student_enrollments e ON e.id = a.enrollment_id
                   WHERE e.class_id = c.id
                     AND a.attendance_date = CURDATE()
               )
             ORDER BY c.branch, c.level, c.name"
        )->fetchAll();
    }

    public function recentAudit(?int $schoolId = null): array
    {
        $schoolId = $this->normalizeSchoolId($schoolId);
        $auditScope = $schoolId === null ? '' : ' WHERE a.school_id = ' . $schoolId;
        return Database::connection()->query(
            "SELECT
                a.id,
                a.action,
                a.entity_type,
                a.entity_id,
                a.created_at,
                u.full_name,
                u.username
             FROM audit_logs a
             LEFT JOIN users u ON u.id = a.user_id$auditScope
             ORDER BY a.id DESC
             LIMIT 8"
        )->fetchAll();
    }

    public function activeAcademicYear(?int $schoolId = null): ?array
    {
        $schoolId = $this->normalizeSchoolId($schoolId);
        $schoolScope = $schoolId === null ? '' : ' AND school_id = ' . $schoolId;
        $row = Database::connection()->query(
            "SELECT id, name, starts_on, ends_on
             FROM academic_years
             WHERE is_active = 1{$schoolScope}
             ORDER BY id DESC
             LIMIT 1"
        )->fetch();

        return $row ?: null;
    }

    public function attendanceTrend(?int $schoolId = null, int $days = 14): array
    {
        $schoolId = $this->normalizeSchoolId($schoolId);
        $days = max(1, min($days, 31));
        $yearScope = $schoolId === null ? '' : ' AND ay.school_id = ' . $schoolId;
        $startOffset = $days - 1;

        $rows = Database::connection()->query(
            "SELECT
                a.attendance_date,
                COUNT(*) AS record_count,
                COALESCE(SUM(a.status = 'present'), 0) AS present_count,
                COALESCE(SUM(a.status = 'absent'), 0) AS absent_count,
                COALESCE(SUM(a.status = 'late'), 0) AS late_count,
                COALESCE(SUM(a.status = 'excused'), 0) AS excused_count
             FROM attendance a
             INNER JOIN student_enrollments e ON e.id = a.enrollment_id
             INNER JOIN classes c ON c.id = e.class_id
             INNER JOIN academic_years ay ON ay.id = c.academic_year_id
             WHERE c.is_active = 1
               AND ay.is_active = 1{$yearScope}
               AND a.attendance_date BETWEEN DATE_SUB(CURDATE(), INTERVAL {$startOffset} DAY) AND CURDATE()
             GROUP BY a.attendance_date
             ORDER BY a.attendance_date"
        )->fetchAll();

        $byDate = [];
        foreach ($rows as $row) {
            $total = (int)($row['record_count'] ?? 0);
            $byDate[(string)$row['attendance_date']] = [
                'date' => (string)$row['attendance_date'],
                'record_count' => $total,
                'present_count' => (int)($row['present_count'] ?? 0),
                'absent_count' => (int)($row['absent_count'] ?? 0),
                'late_count' => (int)($row['late_count'] ?? 0),
                'excused_count' => (int)($row['excused_count'] ?? 0),
            ];
        }

        $result = [];
        $today = new \DateTimeImmutable('today');
        for ($offset = $startOffset; $offset >= 0; --$offset) {
            $date = $today->modify("-{$offset} days")->format('Y-m-d');
            $result[] = $byDate[$date] ?? [
                'date' => $date,
                'record_count' => 0,
                'present_count' => 0,
                'absent_count' => 0,
                'late_count' => 0,
                'excused_count' => 0,
                'presence_rate' => null,
            ];
        }

        return $result;
    }

    public function onlineTeachers(?int $schoolId = null): array
    {
        $schoolId = $this->normalizeSchoolId($schoolId);
        $userScope = $schoolId === null ? '' : ' AND school_id = ' . $schoolId;
        return Database::connection()->query(
            "SELECT id, full_name, employee_id, last_seen_at
             FROM users
             WHERE role = 'teacher'
               AND is_active = 1
               AND last_seen_at >= CURRENT_TIMESTAMP - INTERVAL 90 SECOND
               {$userScope}
             ORDER BY last_seen_at DESC, full_name
             LIMIT 12"
        )->fetchAll();
    }

    private function normalizeSchoolId(?int $schoolId): ?int
    {
        if ($schoolId !== null && $schoolId < 1) {
            throw new \InvalidArgumentException('Invalid school.');
        }
        return $schoolId;
    }
}
