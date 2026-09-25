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
        array $metadata = []
    ): void {
        $action = Audit::actionName($action);

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
                (user_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );

        $stmt->execute([
            $userId,
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
        int $perPage = 50
    ): array {
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $offset = ($page - 1) * $perPage;

        $where = [];
        $params = [];

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
