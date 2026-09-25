<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class TeacherClassRepository
{
    public function forClass(int $classId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT u.id, u.username, u.full_name, u.is_active, tc.assigned_at
             FROM teacher_classes tc
             INNER JOIN users u ON u.id = tc.teacher_id
             WHERE tc.class_id = ? AND u.role = \'teacher\'
             ORDER BY u.full_name, u.username, u.id'
        );
        $stmt->execute([$classId]);
        return $stmt->fetchAll();
    }

    public function forTeacher(int $teacherId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT c.id, c.name, c.level, c.branch, c.academic_year_id, c.is_active, tc.assigned_at
             FROM teacher_classes tc
             INNER JOIN classes c ON c.id = tc.class_id
             WHERE tc.teacher_id = ?
             ORDER BY c.name, c.id'
        );
        $stmt->execute([$teacherId]);
        return $stmt->fetchAll();
    }

    public function exists(int $teacherId, int $classId): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT 1 FROM teacher_classes WHERE teacher_id = ? AND class_id = ? LIMIT 1'
        );
        $stmt->execute([$teacherId, $classId]);
        return (bool)$stmt->fetchColumn();
    }

    public function assign(int $teacherId, int $classId): void
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO teacher_classes (teacher_id, class_id) VALUES (?, ?)'
        );
        $stmt->execute([$teacherId, $classId]);
    }

    public function unassign(int $teacherId, int $classId): void
    {
        $stmt = Database::connection()->prepare(
            'DELETE FROM teacher_classes WHERE teacher_id = ? AND class_id = ?'
        );
        $stmt->execute([$teacherId, $classId]);
    }
}
