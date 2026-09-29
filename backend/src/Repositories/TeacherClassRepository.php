<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class TeacherClassRepository
{
    public function forClass(int $classId, ?int $schoolId = null): array
    {
        $sql = "SELECT u.id, u.username, u.full_name, u.is_active, tc.assigned_at
                FROM teacher_classes tc
                INNER JOIN users u ON u.id = tc.teacher_id
                INNER JOIN classes c ON c.id = tc.class_id
                INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                WHERE tc.class_id = ? AND u.role = 'teacher' AND u.school_id = ay.school_id";
        $params = [$classId];

        if ($schoolId !== null) {
            if ($schoolId < 1) throw new \InvalidArgumentException('Invalid school.');
            $sql .= ' AND ay.school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' ORDER BY u.full_name, u.username, u.id';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function forTeacher(int $teacherId, ?int $schoolId = null): array
    {
        $sql = 'SELECT c.id, c.name, c.level, c.branch, c.academic_year_id, c.is_active, tc.assigned_at
                FROM teacher_classes tc
                INNER JOIN classes c ON c.id = tc.class_id
                INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                INNER JOIN users u ON u.id = tc.teacher_id
                WHERE tc.teacher_id = ? AND u.school_id = ay.school_id';
        $params = [$teacherId];

        if ($schoolId !== null) {
            if ($schoolId < 1) throw new \InvalidArgumentException('Invalid school.');
            $sql .= ' AND ay.school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' ORDER BY c.name, c.id';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function exists(int $teacherId, int $classId, ?int $schoolId = null): bool
    {
        $sql = 'SELECT 1
                FROM teacher_classes tc
                INNER JOIN users u ON u.id = tc.teacher_id
                INNER JOIN classes c ON c.id = tc.class_id
                INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                WHERE tc.teacher_id = ? AND tc.class_id = ? AND u.school_id = ay.school_id';
        $params = [$teacherId, $classId];

        if ($schoolId !== null) {
            if ($schoolId < 1) throw new \InvalidArgumentException('Invalid school.');
            $sql .= ' AND ay.school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' LIMIT 1';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
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
