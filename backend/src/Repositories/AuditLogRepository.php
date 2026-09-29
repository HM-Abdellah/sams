<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Audit;
use SAMS\Helpers\Database;
use SAMS\Helpers\Security;

final class AuditLogRepository
{
    public function record(
        ?int $userId,
        string $action,
        ?string $entityType = null,
        ?int $entityId = null,
        array $metadata = [],
        ?int $schoolId = null
    ): void {
        $action = Audit::actionName($action);

        // Tenant ownership is derived from the actor when present. Anonymous events
        // may provide a verified school scope from the workflow that created them.
        if ($schoolId !== null && $schoolId < 1) {
            throw new \InvalidArgumentException('Invalid audit school.');
        }

        if ($userId !== null) {
            $schoolStmt = Database::connection()->prepare(
                'SELECT school_id FROM users WHERE id = ? LIMIT 1'
            );
            $schoolStmt->execute([$userId]);
            $actorSchoolId = $schoolStmt->fetchColumn();
            if ($actorSchoolId === false) {
                throw new \InvalidArgumentException('Invalid audit user.');
            }
            $actorSchoolId = $actorSchoolId === null ? null : (int)$actorSchoolId;
            if ($actorSchoolId !== null && $actorSchoolId < 1) {
                throw new \InvalidArgumentException('Invalid audit school.');
            }
            if ($schoolId !== null && $actorSchoolId !== null && $schoolId !== $actorSchoolId) {
                throw new \InvalidArgumentException('Audit school does not match the actor.');
            }
            $schoolId = $actorSchoolId;
        }

        if ($entityType !== null) {
            $entityType = trim($entityType);
            if (
                $entityType === ''
                || strlen($entityType) > 50
                || !preg_match('/^[A-Za-z0-9_.:-]+$/', $entityType)
            ) {
                throw new \InvalidArgumentException('Invalid audit entity type.');
            }
        }

        $encoded = null;
        if ($metadata !== []) {
            $encoded = json_encode(
                $metadata,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
            );
        }

        $stmt = Database::connection()->prepare(
            'INSERT INTO audit_logs
                (user_id, school_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );

        $stmt->execute([
            $userId,
            $schoolId,
            $action,
            $entityType,
            $entityId,
            Security::clientIp(),
            Security::userAgent(),
            $encoded,
        ]);
    }

    public function search(
        ?int $userId,
        ?string $action,
        ?string $entityType,
        ?string $fromDate,
        ?string $toDate,
        int $page = 1,
        int $perPage = 50,
        ?int $schoolId = null
    ): array {
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $offset = ($page - 1) * $perPage;

        $where = [];
        $params = [];

        if ($schoolId !== null) {
            if ($schoolId < 1) {
                throw new \InvalidArgumentException('Invalid audit school.');
            }
            $where[] = 'a.school_id = ?';
            $params[] = $schoolId;
        }

        if ($userId !== null) {
            $where[] = 'a.user_id = ?';
            $params[] = $userId;
        }

        if ($action !== null && $action !== '') {
            $where[] = 'a.action = ?';
            $params[] = Audit::actionName($action);
        }

        if ($entityType !== null && $entityType !== '') {
            if (
                strlen($entityType) > 50
                || !preg_match('/^[A-Za-z0-9_.:-]+$/', $entityType)
            ) {
                throw new \InvalidArgumentException('Invalid audit entity type.');
            }
            $where[] = 'a.entity_type = ?';
            $params[] = $entityType;
        }

        if ($fromDate !== null && $fromDate !== '') {
            $where[] = 'a.created_at >= ?';
            $params[] = $fromDate . ' 00:00:00';
        }

        if ($toDate !== null && $toDate !== '') {
            $where[] = 'a.created_at < DATE_ADD(?, INTERVAL 1 DAY)';
            $params[] = $toDate . ' 00:00:00';
        }

        $whereSql = $where === [] ? '' : 'WHERE ' . implode(' AND ', $where);

        $countStmt = Database::connection()->prepare(
            "SELECT COUNT(*)
             FROM audit_logs a
             {$whereSql}"
        );
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $itemsStmt = Database::connection()->prepare(
            "SELECT
                a.id,
                a.user_id,
                u.username,
                u.full_name,
                a.action,
                a.entity_type,
                a.entity_id,
                a.ip_address,
                a.user_agent,
                a.metadata,
                a.created_at
             FROM audit_logs a
             LEFT JOIN users u ON u.id = a.user_id
             {$whereSql}
             ORDER BY a.id DESC
             LIMIT {$perPage} OFFSET {$offset}"
        );
        $itemsStmt->execute($params);

        $items = $itemsStmt->fetchAll();

        foreach ($items as &$item) {
            if (isset($item['metadata']) && is_string($item['metadata']) && $item['metadata'] !== '') {
                $decoded = json_decode($item['metadata'], true);
                $item['metadata'] = is_array($decoded) ? $decoded : null;
            } else {
                $item['metadata'] = null;
            }
        }
        unset($item);

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'pages' => $total === 0 ? 0 : (int)ceil($total / $perPage),
        ];
    }
}
