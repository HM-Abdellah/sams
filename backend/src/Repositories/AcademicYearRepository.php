<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class AcademicYearRepository
{
    public function all(?int $schoolId = null): array
    {
        $sql = 'SELECT id, school_id, name, starts_on, ends_on, is_active, created_at
                FROM academic_years';
        $params = [];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' WHERE school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' ORDER BY starts_on DESC, id DESC';

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function findActive(?int $schoolId = null): ?array
    {
        $sql = 'SELECT id, school_id, name, starts_on, ends_on, is_active, created_at
                FROM academic_years
                WHERE is_active = 1';
        $params = [];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' AND school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' ORDER BY id DESC LIMIT 1';

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function activeForUpdate(?int $schoolId = null): array
    {
        $sql = 'SELECT id
                FROM academic_years
                WHERE is_active = 1';
        $params = [];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' AND school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' ORDER BY id FOR UPDATE';

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function findForUpdate(int $id, ?int $schoolId = null): ?array
    {
        $sql = 'SELECT id, school_id, name, starts_on, ends_on, is_active, created_at
                FROM academic_years
                WHERE id = ?';
        $params = [$id];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' AND school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' LIMIT 1 FOR UPDATE';

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function find(int $id, ?int $schoolId = null): ?array
    {
        $sql = 'SELECT id, school_id, name, starts_on, ends_on, is_active, created_at
                FROM academic_years
                WHERE id = ?';
        $params = [$id];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' AND school_id = ?';
            $params[] = $schoolId;
        }

        $sql .= ' LIMIT 1';

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function overlaps(
        string $startsOn,
        string $endsOn,
        ?int $excludeId = null,
        ?int $schoolId = null
    ): bool {
        $sql = 'SELECT 1
                FROM academic_years
                WHERE starts_on <= ? AND ends_on >= ?';
        $params = [$endsOn, $startsOn];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' AND school_id = ?';
            $params[] = $schoolId;
        }

        if ($excludeId !== null) {
            $sql .= ' AND id <> ?';
            $params[] = $excludeId;
        }

        $sql .= ' LIMIT 1';

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return (bool)$stmt->fetchColumn();
    }

    public function create(
        string $name,
        string $startsOn,
        string $endsOn,
        ?int $schoolId = null
    ): int {
        if ($schoolId === null) {
            $stmt = Database::connection()->prepare(
                'INSERT INTO academic_years (name, starts_on, ends_on, is_active)
                 VALUES (?, ?, ?, 0)'
            );
            $stmt->execute([$name, $startsOn, $endsOn]);
        } else {
            $this->assertSchoolId($schoolId);
            $stmt = Database::connection()->prepare(
                'INSERT INTO academic_years
                    (school_id, name, starts_on, ends_on, is_active)
                 VALUES (?, ?, ?, ?, 0)'
            );
            $stmt->execute([$schoolId, $name, $startsOn, $endsOn]);
        }

        return (int)Database::connection()->lastInsertId();
    }

    /** @return array{classes:int,imports:int} */
    public function dependencyCounts(int $id, int $schoolId): array
    {
        $this->assertSchoolId($schoolId);
        $result = ['classes' => 0, 'imports' => 0];

        $stmt = Database::connection()->prepare(
            'SELECT COUNT(*) FROM classes c
             INNER JOIN academic_years ay ON ay.id = c.academic_year_id
             WHERE c.academic_year_id = ? AND ay.school_id = ?'
        );
        $stmt->execute([$id, $schoolId]);
        $result['classes'] = (int)$stmt->fetchColumn();

        $stmt = Database::connection()->prepare(
            'SELECT COUNT(*) FROM school_import_batches b
             INNER JOIN academic_years ay ON ay.id = b.target_academic_year_id
             WHERE b.target_academic_year_id = ? AND ay.school_id = ?'
        );
        $stmt->execute([$id, $schoolId]);
        $result['imports'] = (int)$stmt->fetchColumn();

        return $result;
    }

    public function delete(int $id, int $schoolId): void
    {
        $this->assertSchoolId($schoolId);
        $stmt = Database::connection()->prepare(
            'DELETE FROM academic_years WHERE id = ? AND school_id = ?'
        );
        $stmt->execute([$id, $schoolId]);

        if ($stmt->rowCount() !== 1) {
            throw new \RuntimeException('Academic year could not be deleted.');
        }
    }

    public function deactivateAll(?int $schoolId = null): void
    {
        $sql = 'UPDATE academic_years SET is_active = 0 WHERE is_active = 1';
        $params = [];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' AND school_id = ?';
            $params[] = $schoolId;
        }

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
    }

    public function activate(int $id, ?int $schoolId = null): void
    {
        $sql = 'UPDATE academic_years SET is_active = 1 WHERE id = ?';
        $params = [$id];

        if ($schoolId !== null) {
            $this->assertSchoolId($schoolId);
            $sql .= ' AND school_id = ?';
            $params[] = $schoolId;
        }

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
    }

    private function assertSchoolId(int $schoolId): void
    {
        if ($schoolId < 1) {
            throw new \InvalidArgumentException('Invalid school.');
        }
    }
}

