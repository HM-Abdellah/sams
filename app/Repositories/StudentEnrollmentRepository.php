<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class StudentEnrollmentRepository
{
    public function findForStudentOnDate(
        int $studentId,
        int $classId,
        string $date
    ): ?array {
        $stmt = Database::connection()->prepare(
            'SELECT id, student_id, class_id, starts_on, ends_on, created_at, updated_at
             FROM student_enrollments
             WHERE student_id = ?
               AND class_id = ?
               AND starts_on <= ?
               AND (ends_on IS NULL OR ends_on >= ?)
             ORDER BY starts_on DESC, id DESC
             LIMIT 1'
        );
        $stmt->execute([$studentId, $classId, $date, $date]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function forClassRange(
        int $classId,
        string $start,
        string $end
    ): array {
        $stmt = Database::connection()->prepare(
            'SELECT id, student_id, class_id, starts_on, ends_on
             FROM student_enrollments
             WHERE class_id = ?
               AND starts_on <= ?
               AND (ends_on IS NULL OR ends_on >= ?)
             ORDER BY student_id, starts_on, id'
        );
        $stmt->execute([$classId, $end, $start]);
        return $stmt->fetchAll();
    }

    public function currentForStudent(int $studentId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, student_id, class_id, starts_on, ends_on, created_at, updated_at
             FROM student_enrollments
             WHERE student_id = ?
               AND ends_on IS NULL
             ORDER BY starts_on DESC, id DESC
             LIMIT 1'
        );
        $stmt->execute([$studentId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(
        int $studentId,
        int $classId,
        string $startsOn,
        ?string $endsOn = null
    ): int {
        $stmt = Database::connection()->prepare(
            'INSERT INTO student_enrollments
                (student_id, class_id, starts_on, ends_on)
             VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$studentId, $classId, $startsOn, $endsOn]);
        return (int)Database::connection()->lastInsertId();
    }

    public function hasAttendanceOnOrAfter(int $enrollmentId, string $date): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT 1
             FROM attendance
             WHERE enrollment_id = ?
               AND attendance_date >= ?
             LIMIT 1'
        );
        $stmt->execute([$enrollmentId, $date]);
        return (bool)$stmt->fetchColumn();
    }

    public function close(int $enrollmentId, string $endsOn): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE student_enrollments
             SET ends_on = ?
             WHERE id = ? AND (ends_on IS NULL OR ends_on > ?)'
        );
        $stmt->execute([$endsOn, $enrollmentId, $endsOn]);
    }
}
