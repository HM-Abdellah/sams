<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;
use PDO;

final class ClassRepository
{
    public function forUser(int $userId, string $role): array
    {
        $pdo = Database::connection();
        if (in_array($role, ['admin', 'counselor'], true)) {
            return $pdo->query('SELECT id, name, level, branch, academic_year_id FROM classes WHERE is_active = 1 ORDER BY name')->fetchAll();
        }
        $stmt = $pdo->prepare(
            'SELECT c.id, c.name, c.level, c.branch, c.academic_year_id
             FROM classes c INNER JOIN teacher_classes tc ON tc.class_id = c.id
             WHERE tc.teacher_id = ? AND c.is_active = 1 ORDER BY c.name'
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public function find(int $classId): ?array
    {
        $stmt = Database::connection()->prepare('SELECT id, name, level, branch, academic_year_id, is_active FROM classes WHERE id = ? LIMIT 1');
        $stmt->execute([$classId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(int $academicYearId, string $name, ?string $level, ?string $branch): int
    {
        $stmt = Database::connection()->prepare('INSERT INTO classes (academic_year_id, name, level, branch) VALUES (?, ?, ?, ?)');
        $stmt->execute([$academicYearId, $name, $level, $branch]);
        return (int)Database::connection()->lastInsertId();
    }

    public function hasAccess(int $userId, string $role, int $classId): bool
    {
        if (in_array($role, ['admin', 'counselor'], true)) {
            $stmt = Database::connection()->prepare('SELECT 1 FROM classes WHERE id = ? AND is_active = 1');
            $stmt->execute([$classId]);
            return (bool)$stmt->fetchColumn();
        }
        $stmt = Database::connection()->prepare(
            'SELECT 1 FROM classes c INNER JOIN teacher_classes tc ON tc.class_id = c.id
             WHERE c.id = ? AND c.is_active = 1 AND tc.teacher_id = ?'
        );
        $stmt->execute([$classId, $userId]);
        return (bool)$stmt->fetchColumn();
    }
}
