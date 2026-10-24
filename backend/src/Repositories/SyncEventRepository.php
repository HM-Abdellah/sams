<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;
use PDO;

/** Stores school-scoped change notifications; payloads deliberately contain no school data. */
final class SyncEventRepository
{
    public function publish(int $schoolId): int
    {
        $this->assertSchoolId($schoolId);
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            "INSERT INTO school_sync_events (school_id, event_type) VALUES (?, 'data.changed')"
        );
        $stmt->execute([$schoolId]);
        $id = (int)$pdo->lastInsertId();

        // Keep the notification log bounded without doing cleanup on every write.
        if ($id > 0 && $id % 500 === 0) {
            $pdo->exec(
                'DELETE FROM school_sync_events
                 WHERE created_at < CURRENT_TIMESTAMP - INTERVAL 2 DAY'
            );
        }

        return $id;
    }

    public function latestIdForSchool(int $schoolId): int
    {
        $this->assertSchoolId($schoolId);
        $stmt = Database::connection()->prepare(
            'SELECT COALESCE(MAX(id), 0) FROM school_sync_events WHERE school_id = ?'
        );
        $stmt->execute([$schoolId]);
        return (int)$stmt->fetchColumn();
    }

    /** @return list<array{id:int,event_type:string,created_at:string}> */
    public function after(int $schoolId, int $eventId, int $limit = 100): array
    {
        $this->assertSchoolId($schoolId);
        if ($eventId < 0) {
            throw new \InvalidArgumentException('Invalid synchronization cursor.');
        }
        $limit = max(1, min(100, $limit));
        $stmt = Database::connection()->prepare(
            'SELECT id, event_type, created_at
             FROM school_sync_events
             WHERE school_id = ? AND id > ?
             ORDER BY id ASC
             LIMIT ' . $limit
        );
        $stmt->execute([$schoolId, $eventId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function assertSchoolId(int $schoolId): void
    {
        if ($schoolId < 1) {
            throw new \InvalidArgumentException('Invalid school.');
        }
    }
}
