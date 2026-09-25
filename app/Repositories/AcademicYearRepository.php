<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class AcademicYearRepository
{
    public function all(): array
    {
        return Database::connection()->query(
            'SELECT id, name, starts_on, ends_on, is_active, created_at
             FROM academic_years
             ORDER BY starts_on DESC, id DESC'
        )->fetchAll();
    }

    public function find(int $id): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, name, starts_on, ends_on, is_active, created_at
             FROM academic_years WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(string $name, string $startsOn, string $endsOn): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO academic_years (name, starts_on, ends_on, is_active)
             VALUES (?, ?, ?, 0)'
        );
        $stmt->execute([$name, $startsOn, $endsOn]);
        return (int)Database::connection()->lastInsertId();
    }

    public function deactivateAll(): void
    {
        Database::connection()->exec(
            'UPDATE academic_years SET is_active = 0 WHERE is_active = 1'
        );
    }

    public function activate(int $id): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE academic_years SET is_active = 1 WHERE id = ?'
        );
        $stmt->execute([$id]);
    }
}
