<?php

declare(strict_types=1);

namespace SAMS\Services;

use SAMS\Helpers\AttendanceMetrics;
use SAMS\Repositories\AdminDashboardRepository;

final class AdminDashboardService
{
    public function __construct(
        private readonly AdminDashboardRepository $repository = new AdminDashboardRepository()
    ) {}

    public function snapshot(?int $schoolId = null): array
    {
        $summary = $this->repository->summary($schoolId);
        $summary['today_presence_rate'] = AttendanceMetrics::presenceRate(
            (int)($summary['today_present'] ?? 0),
            (int)($summary['today_records'] ?? 0),
        );

        $trend = array_map(
            static function (array $row): array {
                $metrics = AttendanceMetrics::counts($row, (int)($row['record_count'] ?? 0));
                return array_merge($row, $metrics);
            },
            $this->repository->attendanceTrend($schoolId),
        );

        $classStats = array_map(
            static function (array $row): array {
                $metrics = AttendanceMetrics::counts($row, (int)($row['today_records'] ?? 0));
                return array_merge($row, $metrics);
            },
            $this->repository->classStats($schoolId),
        );

        return [
            'date' => date('Y-m-d'),
            'academic_year' => $this->repository->activeAcademicYear($schoolId),
            'absence_alert_threshold' => AdminDashboardRepository::ABSENCE_ALERT_THRESHOLD,
            'summary' => $summary,
            'attendance_trend' => $trend,
            'online_teachers' => $this->repository->onlineTeachers($schoolId),
            'class_stats' => $classStats,
            'attention_students' => $this->repository->attentionStudents($schoolId),
            'classes_without_today_records' => $this->repository->classesWithoutTodayRecords($schoolId),
            'recent_audit' => $this->repository->recentAudit($schoolId),
        ];
    }
}
