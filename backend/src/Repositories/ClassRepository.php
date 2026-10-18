<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class ClassRepository
{
    public function forUser(int $userId, string $role, ?int $schoolId = null): array
    {
        $pdo = Database::connection();

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
        }

        if (in_array($role, ['admin', 'counselor'], true)) {
            $sql = 'SELECT c.id, c.name, c.level, c.branch, c.academic_year_id,
                           ay.name AS academic_year_name,
                           ay.starts_on AS academic_year_starts_on,
                           ay.ends_on AS academic_year_ends_on
                    FROM classes c
                    INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                    WHERE c.is_active = 1 AND ay.is_active = 1';
            $params = [];

            if ($schoolId !== null) {
                $sql .= ' AND ay.school_id = ?';
                $params[] = $schoolId;
            }

            $sql .= ' ORDER BY c.name';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            return $stmt->fetchAll();
        }

        $sql = 'SELECT c.id, c.name, c.level, c.branch, c.academic_year_id,
                       ay.name AS academic_year_name,
                       ay.starts_on AS academic_year_starts_on,
                       ay.ends_on AS academic_year_ends_on
                FROM classes c
                INNER JOIN teacher_classes tc ON tc.class_id = c.id
                INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                WHERE tc.teacher_id = ? AND c.is_active = 1 AND ay.is_active = 1';
        $params = [$userId];

        if ($schoolId !== null) {
            $sql .= ' AND ay.school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' ORDER BY c.name';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function allForAdmin(?int $schoolId = null): array
    {
        $sql = 'SELECT
                    c.id,
                    c.name,
                    c.level,
                    c.branch,
                    c.academic_year_id,
                    c.is_active,
                    ay.name AS academic_year_name,
                    ay.is_active AS academic_year_active,
                    COUNT(DISTINCT CASE
                        WHEN e.starts_on <= CURDATE()
                         AND (e.ends_on IS NULL OR e.ends_on >= CURDATE())
                         AND s.status = \'active\'
                        THEN s.id
                    END) AS student_count,
                    COUNT(DISTINCT CASE
                         WHEN u.is_active = 1
                         AND u.role = \'teacher\'
                        THEN u.id
                    END) AS teacher_count
                FROM classes c
                INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                LEFT JOIN student_enrollments e ON e.class_id = c.id
                    AND e.starts_on <= CURDATE()
                    AND (e.ends_on IS NULL OR e.ends_on >= CURDATE())
                LEFT JOIN students s ON s.id = e.student_id
                LEFT JOIN teacher_teachings tt ON tt.class_id = c.id
                LEFT JOIN users u ON u.id = tt.teacher_id';
        $params = [];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' WHERE ay.school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' GROUP BY c.id, c.name, c.level, c.branch, c.academic_year_id, c.is_active, ay.name, ay.is_active, ay.starts_on
                   ORDER BY ay.starts_on DESC, c.name, c.id';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function find(int $classId, ?int $schoolId = null): ?array
    {
        $sql = 'SELECT
                    c.id,
                    c.name,
                    c.level,
                    c.branch,
                    c.academic_year_id,
                    c.is_active,
                    ay.school_id,
                    ay.name AS academic_year_name,
                    ay.starts_on AS academic_year_starts_on,
                    ay.ends_on AS academic_year_ends_on,
                    ay.is_active AS academic_year_active
                FROM classes c
                INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                WHERE c.id = ?';
        $params = [$classId];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' AND ay.school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' LIMIT 1';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findByAcademicYearAndName(
        int $academicYearId,
        string $name,
        ?int $schoolId = null
    ): ?array {
        $sql = 'SELECT
                    c.id,
                    c.name,
                    c.level,
                    c.branch,
                    c.academic_year_id,
                    c.is_active,
                    ay.school_id,
                    ay.name AS academic_year_name,
                    ay.starts_on AS academic_year_starts_on,
                    ay.ends_on AS academic_year_ends_on,
                    ay.is_active AS academic_year_active
                FROM classes c
                INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                WHERE c.academic_year_id = ? AND c.name = ?';
        $params = [$academicYearId, $name];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' AND ay.school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' LIMIT 1';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function findForUpdate(int $classId, ?int $schoolId = null): ?array
    {
        $sql = 'SELECT
                    c.id,
                    c.name,
                    c.level,
                    c.branch,
                    c.academic_year_id,
                    c.is_active,
                    ay.school_id,
                    ay.name AS academic_year_name,
                    ay.starts_on AS academic_year_starts_on,
                    ay.ends_on AS academic_year_ends_on,
                    ay.is_active AS academic_year_active
                FROM classes c
                INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                WHERE c.id = ?';
        $params = [$classId];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' AND ay.school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' LIMIT 1 FOR UPDATE';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function create(
        int $academicYearId,
        string $name,
        ?string $level,
        ?string $branch
    ): int {
        $stmt = Database::connection()->prepare(
            'INSERT INTO classes (academic_year_id, name, level, branch)
             VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$academicYearId, $name, $level, $branch]);
        return (int)Database::connection()->lastInsertId();
    }

    public function update(
        int $classId,
        string $name,
        ?string $level,
        ?string $branch
    ): void {
        $stmt = Database::connection()->prepare(
            'UPDATE classes
             SET name = ?, level = ?, branch = ?
             WHERE id = ?'
        );
        $stmt->execute([$name, $level, $branch, $classId]);
    }

    public function setActive(int $classId, bool $active): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE classes SET is_active = ? WHERE id = ?'
        );
        $stmt->execute([$active ? 1 : 0, $classId]);
    }

    public function hasHistoricalAccess(
        int $userId,
        string $role,
        int $classId,
        ?int $schoolId = null
    ): bool {
        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
        }

        if (in_array($role, ['admin', 'counselor'], true)) {
            $sql = 'SELECT 1
                    FROM classes c
                    INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                    WHERE c.id = ?';
            $params = [$classId];

            if ($schoolId !== null) {
                $sql .= ' AND ay.school_id = ?';
                $params[] = $schoolId;
            }

            $sql .= ' LIMIT 1';
            $stmt = Database::connection()->prepare($sql);
            $stmt->execute($params);
            return (bool)$stmt->fetchColumn();
        }

        if ($role !== 'teacher') {
            return false;
        }

        $sql = 'SELECT 1
                FROM classes c
                INNER JOIN teacher_classes tc ON tc.class_id = c.id
                INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                WHERE c.id = ? AND tc.teacher_id = ?';
        $params = [$classId, $userId];

        if ($schoolId !== null) {
            $sql .= ' AND ay.school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' LIMIT 1';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);

        return (bool)$stmt->fetchColumn();
    }

    public function hasAccess(
        int $userId,
        string $role,
        int $classId,
        ?int $schoolId = null
    ): bool {
        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
        }

        if (in_array($role, ['admin', 'counselor'], true)) {
            $sql = 'SELECT 1
                    FROM classes c
                    INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                    WHERE c.id = ? AND c.is_active = 1 AND ay.is_active = 1';
            $params = [$classId];

            if ($schoolId !== null) {
                $sql .= ' AND ay.school_id = ?';
                $params[] = $schoolId;
            }

            $stmt = Database::connection()->prepare($sql);
            $stmt->execute($params);
            return (bool)$stmt->fetchColumn();
        }

        $sql = 'SELECT 1
                FROM classes c
                INNER JOIN teacher_classes tc ON tc.class_id = c.id
                INNER JOIN academic_years ay ON ay.id = c.academic_year_id
                WHERE c.id = ? AND c.is_active = 1 AND ay.is_active = 1 AND tc.teacher_id = ?';
        $params = [$classId, $userId];

        if ($schoolId !== null) {
            $sql .= ' AND ay.school_id = ?';
            $params[] = $schoolId;
        }

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return (bool)$stmt->fetchColumn();
    }

    private function assertSchoolId(int $schoolId): void
    {
        if ($schoolId < 1) {
            throw new \InvalidArgumentException('Invalid school.');
        }
    }
}
