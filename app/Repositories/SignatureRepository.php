<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class SignatureRepository
{
    public function findByTeacherAndClass(int $teacherId, int $classId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, signature_data, mime_type, updated_at FROM signatures WHERE teacher_id = ? AND class_id = ? LIMIT 1'
        );
        $stmt->execute([$teacherId, $classId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function upsert(int $teacherId, int $classId, string $data): void
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO signatures (teacher_id, class_id, signature_data, mime_type)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE signature_data = VALUES(signature_data), mime_type = VALUES(mime_type), updated_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([$teacherId, $classId, $data, 'image/png']);
    }

    public function delete(int $teacherId, int $classId): void
    {
        $stmt = Database::connection()->prepare('DELETE FROM signatures WHERE teacher_id = ? AND class_id = ?');
        $stmt->execute([$teacherId, $classId]);
    }
}
