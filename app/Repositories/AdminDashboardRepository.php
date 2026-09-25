<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class AdminDashboardRepository
{
    public const ABSENCE_ALERT_THRESHOLD = 5;

    public function summary(): array
    {
        $pdo = Database::connection();
        $summary = $pdo->query(
            "SELECT
                (SELECT COUNT(*)
                 FROM classes c
                 INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                 WHERE c.is_active = 1 AND ay.is_active = 1) AS active_classes,
                (SELECT COUNT(DISTINCT e.student_id)
                 FROM student_enrollments e
                 INNER JOIN classes c ON c.id = e.class_id
                 INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                 INNER JOIN students s ON s.id = e.student_id
                 WHERE c.is_active = 1 AND ay.is_active = 1
                   AND s.status = 'active'
                   AND e.starts_on <= CURDATE()
                   AND (e.ends_on IS NULL OR e.ends_on >= CURDATE())) AS active_students,
                (SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = 1) AS active_teachers,
                (SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = 1 AND last_seen_at >= UTC_TIMESTAMP() - INTERVAL 90 SECOND) AS online_teachers,
                (SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = 1 AND phone_verified = 0) AS unverified_teachers,
                (SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = 1 AND locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP) AS locked_teachers,
                (SELECT COUNT(*)
                 FROM attendance a
                 INNER JOIN student_enrollments e ON e.id = a.enrollment_id
                 INNER JOIN classes c ON c.id = e.class_id
                 INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                 WHERE c.is_active = 1 AND ay.is_active = 1 AND a.attendance_date = CURDATE()) AS today_records,
                (SELECT COALESCE(SUM(a.status = 'present'), 0)
                 FROM attendance a
                 INNER JOIN student_enrollments e ON e.id = a.enrollment_id
                 INNER JOIN classes c ON c.id = e.class_id
                 INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                 WHERE c.is_active = 1 AND ay.is_active = 1 AND a.attendance_date = CURDATE()) AS today_present,
                (SELECT COALESCE(SUM(a.status = 'absent'), 0)
                 FROM attendance a
                 INNER JOIN student_enrollments e ON e.id = a.enrollment_id
                 INNER JOIN classes c ON c.id = e.class_id
                 INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                 WHERE c.is_active = 1 AND ay.is_active = 1 AND a.attendance_date = CURDATE()) AS today_absent,
                (SELECT COALESCE(SUM(a.status = 'late'), 0)
                 FROM attendance a
                 INNER JOIN student_enrollments e ON e.id = a.enrollment_id
                 INNER JOIN classes c ON c.id = e.class_id
                 INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                 WHERE c.is_active = 1 AND ay.is_active = 1 AND a.attendance_date = CURDATE()) AS today_late,
                (SELECT COALESCE(SUM(a.status = 'excused'), 0)
                 FROM attendance a
                 INNER JOIN student_enrollments e ON e.id = a.enrollment_id
                 INNER JOIN classes c ON c.id = e.class_id
                 INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                 WHERE c.is_active = 1 AND ay.is_active = 1 AND a.attendance_date = CURDATE()) AS today_excused"
        )->fetch();

        $todayTotal = (int)($summary['today_records'] ?? 0);
        $summary['today_presence_rate'] = $todayTotal > 0
            ? round(((int)$summary['today_present'] / $todayTotal) * 100, 1)
            : 0.0;

        return $summary ?: [];
    }

    public function classStats(): array
    {
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
             WHERE c.is_active = 1 AND ay.is_active = 1
             GROUP BY c.id, c.name, c.level, c.branch, ay.id, ay.name
             ORDER BY c.branch, c.level, c.name, c.id"
        )->fetchAll();
    }

    public function attentionStudents(): array
    {
        $threshold = self::ABSENCE_ALERT_THRESHOLD;
        $stmt = Database::connection()->query(
            "SELECT
                s.id,
                s.first_name,
                s.last_name,
                c.id AS class_id,
                c.name AS class_name,
                c.level AS class_level,
                c.branch AS class_branch,
                COALESCE(SUM(a.status = 'absent'), 0) AS absent_count,
                COALESCE(SUM(a.status = 'late'), 0) AS late_count
             FROM students s
             INNER JOIN student_enrollments e ON e.student_id = s.id
             INNER JOIN classes c ON c.id = e.class_id
             INNER JOIN academic_years ay ON ay.id = c.academic_year_id
             LEFT JOIN attendance a ON a.enrollment_id = e.id
                AND a.attendance_date BETWEEN ay.starts_on AND LEAST(ay.ends_on, CURDATE())
             WHERE s.status = 'active'
               AND c.is_active = 1
               AND ay.is_active = 1
               AND e.starts_on <= CURDATE()
               AND (e.ends_on IS NULL OR e.ends_on >= CURDATE())
             GROUP BY s.id, s.first_name, s.last_name, c.id, c.name, c.level, c.branch
             HAVING absent_count >= {$threshold}
             ORDER BY absent_count DESC, late_count DESC, s.last_name, s.first_name
             LIMIT 10"
        );
        return $stmt->fetchAll();
    }

    public function classesWithoutTodayRecords(): array
    {
        return Database::connection()->query(
            "SELECT c.id, c.name, c.level, c.branch, ay.name AS academic_year_name
             FROM classes c
             INNER JOIN academic_years ay ON ay.id = c.academic_year_id
             LEFT JOIN attendance a ON a.attendance_date = CURDATE()
             LEFT JOIN student_enrollments e ON e.id = a.enrollment_id AND e.class_id = c.id
             WHERE c.is_active = 1 AND ay.is_active = 1
             GROUP BY c.id, c.name, c.level, c.branch, ay.name
             HAVING COUNT(a.id) = 0
             ORDER BY c.branch, c.level, c.name"
        )->fetchAll();
    }

    public function recentAudit(): array
    {
        return Database::connection()->query(
            'SELECT
                a.id,
                a.action,
                a.entity_type,
                a.entity_id,
                a.created_at,
                u.full_name,
                u.username
             FROM audit_logs a
             LEFT JOIN users u ON u.id = a.user_id
             ORDER BY a.id DESC
             LIMIT 8'
        )->fetchAll();
    }
}
