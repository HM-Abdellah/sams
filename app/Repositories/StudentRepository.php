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
             FROM students
             WHERE class_id = ?
             ORDER BY last_name, first_name, id'
        );
        $stmt->execute([$classId]);

        return $stmt->fetchAll();
    }

    public function existingMassarCodes(array $codes): array
    {
        $codes = array_values(array_unique(array_filter(
            array_map(static fn($v) => trim((string)$v), $codes),
            static fn($v) => $v !== ''
        )));
        if ($codes === []) return [];

        $placeholders = implode(',', array_fill(0, count($codes), '?'));
        $stmt = Database::connection()->prepare(
            "SELECT id, massar_code FROM students
             WHERE massar_code IN ({$placeholders})"
        );
        $stmt->execute($codes);

        $result = [];
        foreach ($stmt->fetchAll() as $row) {
            $result[(string)$row['massar_code']] = (int)$row['id'];
        }
        return $result;
    }

    public function existingNumbersInClass(int $classId, array $numbers): array
    {
        $numbers = array_values(array_unique(array_filter(
            array_map(static fn($v) => trim((string)$v), $numbers),
            static fn($v) => $v !== ''
        )));
        if ($numbers === []) return [];

        $placeholders = implode(',', array_fill(0, count($numbers), '?'));
        $params = array_merge([$classId], $numbers);

        $stmt = Database::connection()->prepare(
            "SELECT student_number FROM students
             WHERE class_id = ? AND student_number IN ({$placeholders})"
        );
        $stmt->execute($params);

        $result = [];
        foreach ($stmt->fetchAll() as $row) {
            $result[(string)$row['student_number']] = true;
        }
        return $result;
    }

    public function findInClass(int $studentId, int $classId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                id,
                class_id,
                student_number,
                massar_code,
                birth_date,
                first_name,
                last_name,
                status,
                created_at,
                updated_at
             FROM students
             WHERE id = ? AND class_id = ?
             LIMIT 1'
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
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            'INSERT INTO students
                (class_id, student_number, massar_code, birth_date, first_name, last_name)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $classId,
            $number,
            $massarCode,
            $birthDate,
            $firstName,
            $lastName,
        ]);

        $studentId = (int)$pdo->lastInsertId();

        // A student record is not valid for attendance until an enrollment exists.
        // Derive its initial enrollment boundary from the class academic year.
        $startStmt = $pdo->prepare(
            'SELECT ay.starts_on
             FROM classes c
             INNER JOIN academic_years ay ON ay.id = c.academic_year_id
             WHERE c.id = ?
             LIMIT 1'
        );
        $startStmt->execute([$classId]);
        $startsOn = $startStmt->fetchColumn();

        if (!is_string($startsOn) || $startsOn === '') {
            throw new \RuntimeException('Unable to determine student enrollment start date.');
        }

        $enrollmentStmt = $pdo->prepare(
            'INSERT INTO student_enrollments
                (student_id, class_id, starts_on, ends_on)
             VALUES (?, ?, ?, NULL)'
        );
        $enrollmentStmt->execute([
            $studentId,
            $classId,
            $startsOn,
        ]);

        return $studentId;
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
             SET student_number = ?,
                 massar_code = ?,
                 birth_date = ?,
                 first_name = ?,
                 last_name = ?
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
            'UPDATE students
             SET status = \'inactive\'
             WHERE id = ? AND class_id = ?'
        );
        $stmt->execute([$studentId, $classId]);
    }
}
