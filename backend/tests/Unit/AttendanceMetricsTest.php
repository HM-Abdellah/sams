<?php

declare(strict_types=1);

namespace SAMS\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SAMS\Helpers\AttendanceMetrics;

final class AttendanceMetricsTest extends TestCase
{
    public function testPresenceRateUsesRecordedEntriesAndRoundsToOneDecimal(): void
    {
        self::assertSame(66.7, AttendanceMetrics::presenceRate(2, 3));
    }

    public function testPresenceRateIsNullWhenNothingWasRecorded(): void
    {
        self::assertNull(AttendanceMetrics::presenceRate(0, 0));
        self::assertNull(AttendanceMetrics::presenceRate(2, 0));
    }

    public function testCountsPreserveIndependentStatusCountsAndExposeSharedRate(): void
    {
        self::assertSame([
            'present_count' => 2,
            'absent_count' => 1,
            'late_count' => 1,
            'excused_count' => 0,
            'recorded_count' => 4,
            'presence_rate' => 50.0,
        ], AttendanceMetrics::counts([
            'present_count' => '2',
            'absent_count' => '1',
            'late_count' => '1',
            'excused_count' => '0',
            'recorded_count' => '4',
        ]));
    }
}
