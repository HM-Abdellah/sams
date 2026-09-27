<?php

declare(strict_types=1);

namespace SAMS\Services;

use DateTimeImmutable;
use SAMS\Repositories\AuditLogRepository;

final class AuditAdministrationService
{
    public function __construct(
        private readonly AuditLogRepository $repository = new AuditLogRepository()
    ) {}

    public function search(
        ?int $userId,
        ?string $action,
        ?string $entityType,
        ?string $fromDate,
        ?string $toDate,
        int $page = 1,
        int $perPage = 50
    ): array {
        if ($userId !== null && $userId < 1) {
            throw new \InvalidArgumentException('Invalid user_id.');
        }

        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));

        foreach (['from' => $fromDate, 'to' => $toDate] as $field => $value) {
            if ($value === null) continue;

            $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
            if (!$date || $date->format('Y-m-d') !== $value) {
                throw new \InvalidArgumentException("Invalid {$field} date.");
            }
        }

        if ($fromDate !== null && $toDate !== null && $fromDate > $toDate) {
            throw new \InvalidArgumentException('Invalid audit date range.');
        }

        return $this->repository->search(
            $userId,
            $action,
            $entityType,
            $fromDate,
            $toDate,
            $page,
            $perPage
        );
    }
}