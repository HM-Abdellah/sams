<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class TeacherRepository
{
    public const ONLINE_WINDOW_SECONDS = 90;

    public function all(): array
    {
        return Database::connection()->query(
            "SELECT
                u.id,
                u.username,
                u.employee_id,
                u.full_name,
                u.phone,
                u.phone_verified,
                u.is_active,
                u.failed_login_attempts,
                u.locked_until,
                u.last_login_at,
                u.last_seen_at,
                CASE
                    WHEN u.last_seen_at IS NOT NULL
                     AND u.last_seen_at >= CURRENT_TIMESTAMP - INTERVAL 90 SECOND
                    THEN 1 ELSE 0
                END AS is_online
             FROM users u
             WHERE u.role = 'teacher'
             ORDER BY u.full_name, u.employee_id, u.id"
        )->fetchAll();
    }

    public function teachings(): array
    {
        return Database::connection()->query(
            'SELECT
                tt.id,
                tt.teacher_id,
                tt.subject_id,
                s.code AS subject_code,
                s.name_fr AS subject_name_fr,
                s.name_ar AS subject_name_ar,
                s.name_en AS subject_name_en,
                tt.class_id,
                c.name AS class_name,
                c.level AS class_level,
                c.branch AS class_branch,
                c.academic_year_id,
                ay.name AS academic_year_name,
                tt.assigned_at
             FROM teacher_teachings tt
             INNER JOIN subjects s ON s.id = tt.subject_id
             INNER JOIN classes c ON c.id = tt.class_id
             INNER JOIN academic_years ay ON ay.id = c.academic_year_id
             WHERE c.is_active = 1 AND ay.is_active = 1
             ORDER BY tt.teacher_id, s.name_fr, c.branch, c.name, tt.id'
        )->fetchAll();
    }

    public function subjects(): array
    {
        return Database::connection()->query(
            'SELECT id, code, name_fr, name_ar, name_en, is_active
             FROM subjects
             ORDER BY is_active DESC, name_fr, code, id'
        )->fetchAll();
    }

    public function teacherExists(int $teacherId): bool
    {
        $stmt = Database::connection()->prepare(
            "SELECT 1 FROM users WHERE id = ? AND role = 'teacher' LIMIT 1"
        );
        $stmt->execute([$teacherId]);
        return (bool)$stmt->fetchColumn();
    }

    public function assign(int $teacherId, int $subjectId, int $classId): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO teacher_teachings (teacher_id, subject_id, class_id)
             VALUES (?, ?, ?)'
        );
        $stmt->execute([$teacherId, $subjectId, $classId]);
        return (int)Database::connection()->lastInsertId();
    }

    public function unassign(int $teachingId): void
    {
        $stmt = Database::connection()->prepare('DELETE FROM teacher_teachings WHERE id = ?');
        $stmt->execute([$teachingId]);
    }

    public function createSubject(string $code, string $nameFr, string $nameAr, string $nameEn): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO subjects (code, name_fr, name_ar, name_en) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$code, $nameFr, $nameAr, $nameEn]);
        return (int)Database::connection()->lastInsertId();
    }

    public function updateSubject(int $subjectId, string $code, string $nameFr, string $nameAr, string $nameEn, bool $isActive): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE subjects
             SET code = ?, name_fr = ?, name_ar = ?, name_en = ?, is_active = ?
             WHERE id = ?'
        );
        $stmt->execute([$code, $nameFr, $nameAr, $nameEn, $isActive ? 1 : 0, $subjectId]);
    }

    public function subjectExists(int $subjectId): bool
    {
        $stmt = Database::connection()->prepare('SELECT 1 FROM subjects WHERE id = ? LIMIT 1');
        $stmt->execute([$subjectId]);
        return (bool)$stmt->fetchColumn();
    }

    public function subjectExistsActive(int $subjectId): bool
    {
        $stmt = Database::connection()->prepare('SELECT 1 FROM subjects WHERE id = ? AND is_active = 1 LIMIT 1');
        $stmt->execute([$subjectId]);
        return (bool)$stmt->fetchColumn();
    }

    public function classExistsActive(int $classId): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT 1
             FROM classes c
             INNER JOIN academic_years ay ON ay.id = c.academic_year_id
             WHERE c.id = ? AND c.is_active = 1 AND ay.is_active = 1
             LIMIT 1'
        );
        $stmt->execute([$classId]);
        return (bool)$stmt->fetchColumn();
    }

    public function ensureClassAccess(int $teacherId, int $classId): void
    {
        $stmt = Database::connection()->prepare(
            'INSERT IGNORE INTO teacher_classes (teacher_id, class_id) VALUES (?, ?)'
        );
        $stmt->execute([$teacherId, $classId]);
    }
}
