<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class StudentRepository
{
    public function forClass(int $classId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, student_number, massar_code, birth_date, first_name, last_name, status, created_at, updated_at
             FROM students WHERE class_id = ? ORDER BY last_name, first_name, id'
        );
        $stmt->execute([$classId]);
        return $stmt->fetchAll();
    }

    public function findInClass(int $studentId, int $classId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, class_id, student_number, massar_code, birth_date, first_name, last_name, status, created_at, updated_at
             FROM students WHERE id = ? AND class_id = ? LIMIT 1'
        );
        $stmt->execute([$studentId, $classId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(
        int $classId,
        ?string $number,
        ?string $massarCode,
        ?string $birthDate,
        string $firstName,
        string $lastName
    ): int {
        $stmt = Database::connection()->prepare(
            'INSERT INTO students (class_id, student_number, massar_code, birth_date, first_name, last_name)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$classId, $number, $massarCode, $birthDate, $firstName, $lastName]);
        return (int)Database::connection()->lastInsertId();
    }

    public function update(
        int $studentId,
        int $classId,
        ?string $number,
        ?string $massarCode,
        ?string $birthDate,
        string $firstName,
        string $lastName
    ): void {
        $stmt = Database::connection()->prepare(
            'UPDATE students
             SET student_number = ?, massar_code = ?, birth_date = ?, first_name = ?, last_name = ?
             WHERE id = ? AND class_id = ?'
        );
        $stmt->execute([
            $number,
            $massarCode,
            $birthDate,
            $firstName,
            $lastName,
            $studentId,
            $classId,
        ]);
    }

    public function deactivate(int $studentId, int $classId): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE students SET status = \'inactive\' WHERE id = ? AND class_id = ?'
        );
        $stmt->execute([$studentId, $classId]);
    }
}
