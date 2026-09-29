<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class SignatureRepository
{
    public function findByTeacherAndClass(int $teacherId, int $classId, int $schoolId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT s.id, s.signature_data, s.mime_type, s.updated_at
             FROM signatures s
             INNER JOIN classes c ON c.id = s.class_id
             INNER JOIN academic_years ay ON ay.id = c.academic_year_id
             INNER JOIN users u ON u.id = s.teacher_id
             WHERE s.teacher_id = ?
               AND s.class_id = ?
               AND ay.school_id = ?
               AND u.school_id = ?
             LIMIT 1'
        );
        $stmt->execute([$teacherId, $classId, $schoolId, $schoolId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function upsert(int $teacherId, int $classId, string $data, int $schoolId): void
    {
        $scope = Database::connection()->prepare(
            'SELECT 1
             FROM classes c
             INNER JOIN academic_years ay ON ay.id = c.academic_year_id
             INNER JOIN users u ON u.id = ?
             WHERE c.id = ?
               AND ay.school_id = ?
               AND u.school_id = ?
             LIMIT 1'
        );
        $scope->execute([$teacherId, $classId, $schoolId, $schoolId]);

        if ($scope->fetchColumn() === false) {
            throw new \InvalidArgumentException('Signature tenant scope mismatch.');
        }

        $stmt = Database::connection()->prepare(
            'INSERT INTO signatures (teacher_id, class_id, signature_data, mime_type)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE signature_data = VALUES(signature_data), mime_type = VALUES(mime_type), updated_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([$teacherId, $classId, $data, 'image/png']);
    }

    public function delete(int $teacherId, int $classId, int $schoolId): void
    {
        $stmt = Database::connection()->prepare(
            'DELETE s
             FROM signatures s
             INNER JOIN classes c ON c.id = s.class_id
             INNER JOIN academic_years ay ON ay.id = c.academic_year_id
             INNER JOIN users u ON u.id = s.teacher_id
             WHERE s.teacher_id = ?
               AND s.class_id = ?
               AND ay.school_id = ?
               AND u.school_id = ?'
        );
        $stmt->execute([$teacherId, $classId, $schoolId, $schoolId]);
    }
}
