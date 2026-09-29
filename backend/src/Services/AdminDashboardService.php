<?php

declare(strict_types=1);

namespace SAMS\Services;

use SAMS\Repositories\AdminDashboardRepository;

final class AdminDashboardService
{
    public function __construct(
        private readonly AdminDashboardRepository $repository = new AdminDashboardRepository()
    ) {}

    public function snapshot(?int $schoolId = null): array
    {
        return [
            'date' => date('Y-m-d'),
            'absence_alert_threshold' => AdminDashboardRepository::ABSENCE_ALERT_THRESHOLD,
            'summary' => $this->repository->summary($schoolId),
            'class_stats' => $this->repository->classStats($schoolId),
            'attention_students' => $this->repository->attentionStudents($schoolId),
            'classes_without_today_records' => $this->repository->classesWithoutTodayRecords($schoolId),
            'recent_audit' => $this->repository->recentAudit($schoolId),
        ];
    }
}