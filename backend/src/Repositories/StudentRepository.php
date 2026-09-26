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
        $students = $this->studentsByMassarCodes($codes);
        $result = [];

        foreach ($students as $student) {
            $result[(string)$student['massar_code']] = (int)$student['id'];
        }

        return $result;
    }

    public function studentsByMassarCodes(array $codes): array
    {
        $codes = array_values(array_unique(array_filter(
            array_map(static fn($v): string => trim((string)$v), $codes),
            static fn(string $v): bool => $v !== ''
        )));
        if ($codes === []) return [];

        $placeholders = implode(',', array_fill(0, count($codes), '?'));
        $stmt = Database::connection()->prepare(
            "SELECT
                id,
                class_id,
                student_number,
                massar_code,
                birth_date,
                first_name,
                last_name,
                status
             FROM students
             WHERE massar_code IN ({$placeholders})"
        );
        $stmt->execute($codes);

        $result = [];
        foreach ($stmt->fetchAll() as $row) {
            $result[$this->massarKey((string)$row['massar_code'])] = $row;
        }

        return $result;
    }

    public function existingNumbersInClass(int $classId, array $numbers): array
    {
        return array_fill_keys(
            array_keys($this->numberOwnersInClass($classId, $numbers)),
            true
        );
    }

    /** @return array<string,int> */
    public function numberOwnersInClass(int $classId, array $numbers): array
    {
        $numbers = array_values(array_unique(array_filter(
            array_map(static fn($v): string => trim((string)$v), $numbers),
            static fn(string $v): bool => $v !== ''
        )));
        if ($numbers === []) return [];

        $placeholders = implode(',', array_fill(0, count($numbers), '?'));
        $params = array_merge([$classId], $numbers);

        $stmt = Database::connection()->prepare(
            "SELECT id, student_number
             FROM students
             WHERE class_id = ? AND student_number IN ({$placeholders})"
        );
        $stmt->execute($params);

        $result = [];
        foreach ($stmt->fetchAll() as $row) {
            $result[$this->numberKey((string)$row['student_number'])] = (int)$row['id'];
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

    public function findByIdForUpdate(int $studentId): ?array
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
                status
             FROM students
             WHERE id = ?
             LIMIT 1
             FOR UPDATE'
        );
        $stmt->execute([$studentId]);
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

        $created = $this->createWithEnrollment(
            $classId,
            $number,
            $massarCode,
            $birthDate,
            $firstName,
            $lastName,
            $startsOn
        );

        return $created['student_id'];
    }

    /** @return array{student_id:int,enrollment_id:int} */
    public function createWithEnrollment(
        int $classId,
        ?string $number,
        ?string $massarCode,
        ?string $birthDate,
        string $firstName,
        string $lastName,
        string $startsOn
    ): array {
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

        return [
            'student_id' => $studentId,
            'enrollment_id' => (int)$pdo->lastInsertId(),
        ];
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

    public function updateCurrentClassAndNumber(
        int $studentId,
        int $classId,
        ?string $number
    ): void {
        $stmt = Database::connection()->prepare(
            'UPDATE students
             SET class_id = ?,
                 student_number = ?
             WHERE id = ?'
        );
        $stmt->execute([$classId, $number, $studentId]);
    }

    public function transfer(int $studentId, int $fromClassId, int $toClassId): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE students
             SET class_id = ?, status = 'active'
             WHERE id = ? AND class_id = ?'
        );
        $stmt->execute([$toClassId, $studentId, $fromClassId]);

        if ($stmt->rowCount() !== 1) {
            throw new \RuntimeException('Student transfer could not be completed.');
        }
    }

    public function deactivate(int $studentId, int $classId): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE students
             SET status = 'inactive'
             WHERE id = ? AND class_id = ?'
        );
        $stmt->execute([$studentId, $classId]);
    }

    private function massarKey(string $value): string
    {
        return strtolower(trim($value));
    }

    private function numberKey(string $value): string
    {
        return strtolower(trim($value));
    }
}
