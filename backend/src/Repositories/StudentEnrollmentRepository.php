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

    /**
     * Return all enrollments for the given students that overlap one academic year.
     *
     * @param list<int> $studentIds
     * @return list<array<string,mixed>>
     */
    public function forStudentsInAcademicYear(
        array $studentIds,
        int $academicYearId,
        bool $forUpdate = false
    ): array {
        $studentIds = array_values(array_unique(array_filter(
            array_map(static fn($v): int => (int)$v, $studentIds),
            static fn(int $v): bool => $v > 0
        )));

        if ($studentIds === []) return [];

        $placeholders = implode(',', array_fill(0, count($studentIds), '?'));
        $sql = "SELECT
                    e.id,
                    e.student_id,
                    e.class_id,
                    e.starts_on,
                    e.ends_on
                FROM student_enrollments e
                INNER JOIN classes c ON c.id = e.class_id
                INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                WHERE ay.id = ?
                  AND e.student_id IN ({$placeholders})
                  AND e.starts_on <= ay.ends_on
                  AND (e.ends_on IS NULL OR e.ends_on >= ay.starts_on)
                ORDER BY e.student_id, e.starts_on, e.id";

        if ($forUpdate) {
            $sql .= ' FOR UPDATE';
        }

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute(array_merge([$academicYearId], $studentIds));

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

    public function hasOverlappingEnrollment(
        int $studentId,
        string $startsOn,
        ?string $endsOn = null,
        ?int $excludeId = null
    ): bool
    {
        $effectiveEnd = $endsOn ?? '9999-12-31';
        $sql = 'SELECT 1
                FROM student_enrollments
                WHERE student_id = ?
                  AND starts_on <= ?
                  AND (ends_on IS NULL OR ends_on >= ?)';
        $params = [$studentId, $effectiveEnd, $startsOn];

        if ($excludeId !== null) {
            $sql .= ' AND id <> ?';
            $params[] = $excludeId;
        }

        $sql .= ' LIMIT 1';

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return (bool)$stmt->fetchColumn();
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
