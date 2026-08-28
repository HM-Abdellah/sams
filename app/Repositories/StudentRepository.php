<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class StudentRepository
{
    public function forClass(int $classId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, student_number, first_name, last_name, status, created_at, updated_at
             FROM students WHERE class_id = ? ORDER BY last_name, first_name, id'
        );
        $stmt->execute([$classId]);
        return $stmt->fetchAll();
    }

    public function findInClass(int $studentId, int $classId): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM students WHERE id = ? AND class_id = ? LIMIT 1');
        $stmt->execute([$studentId, $classId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(int $classId, ?string $number, string $firstName, string $lastName): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO students (class_id, student_number, first_name, last_name) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$classId, $number, $firstName, $lastName]);
        return (int)Database::connection()->lastInsertId();
    }

    public function deactivate(int $studentId, int $classId): void
    {
        $stmt = Database::connection()->prepare('UPDATE students SET status = \'inactive\' WHERE id = ? AND class_id = ?');
        $stmt->execute([$studentId, $classId]);
    }
}
