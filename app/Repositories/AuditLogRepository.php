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
            if ($entityType === '' || strlen($entityType) > 50 || !preg_match('/^[A-Za-z0-9_.:-]+$/', $entityType)) {
                throw new \InvalidArgumentException('Invalid audit entity type.');
            }
        }

        $encoded = null;
        if ($metadata !== []) {
            $encoded = json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        }

        $stmt = Database::connection()->prepare(
            'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
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
}
