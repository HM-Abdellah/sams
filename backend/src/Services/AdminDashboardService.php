<?php

declare(strict_types=1);

namespace SAMS\Services;

use SAMS\Repositories\AdminDashboardRepository;

final class AdminDashboardService
{
    public function __construct(
        private readonly AdminDashboardRepository $repository = new AdminDashboardRepository()
    ) {}

    public function snapshot(): array
    {
        return [
            'date' => date('Y-m-d'),
            'absence_alert_threshold' => AdminDashboardRepository::ABSENCE_ALERT_THRESHOLD,
            'summary' => $this->repository->summary(),
            'class_stats' => $this->repository->classStats(),
            'attention_students' => $this->repository->attentionStudents(),
            'classes_without_today_records' => $this->repository->classesWithoutTodayRecords(),
            'recent_audit' => $this->repository->recentAudit(),
        ];
    }
}