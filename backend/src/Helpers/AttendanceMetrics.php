<?php

declare(strict_types=1);

namespace SAMS\Helpers;

final class AttendanceMetrics
{
    /**
     * Presence rate is based only on persisted attendance entries.
     * A null result means there are no recorded entries in the requested scope.
     */
    public static function presenceRate(int $present, int $recorded): ?float
    {
        if ($recorded <= 0) return null;
        return round(($present / $recorded) * 100, 1);
    }

    /**
     * Normalize a repository aggregate into the shared attendance metric contract.
     * Status values are kept as independent counts; no status is reclassified.
     */
    public static function counts(array $row, ?int $recordedOverride = null): array
    {
        $present = (int)($row['present_count'] ?? 0);
        $absent = (int)($row['absent_count'] ?? 0);
        $late = (int)($row['late_count'] ?? 0);
        $excused = (int)($row['excused_count'] ?? 0);
        $recorded = $recordedOverride ?? (int)($row['recorded_count'] ?? 0);

        return [
            'present_count' => $present,
            'absent_count' => $absent,
            'late_count' => $late,
            'excused_count' => $excused,
            'recorded_count' => $recorded,
            'presence_rate' => self::presenceRate($present, $recorded),
        ];
    }

    private function __construct() {}
}
