<?php

declare(strict_types=1);

namespace SAMS\Services;

use DateTimeImmutable;
use InvalidArgumentException;

final class AttendanceService
{
    public const STATUSES = ['present', 'absent', 'late', 'excused'];

    public function validate(int $studentId, string $date, int $period, string $status): array
    {
        if ($studentId < 1) throw new InvalidArgumentException('Invalid student.');
        $d = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        if (!$d || $d->format('Y-m-d') !== $date) throw new InvalidArgumentException('Invalid attendance date.');
        if ($period < 1 || $period > 8) throw new InvalidArgumentException('Invalid period.');
        if (!$this->validStatus($status)) throw new InvalidArgumentException('Invalid attendance status.');
        return compact('studentId', 'date', 'period', 'status');
    }

    public function validStatus(string $status): bool
    {
        return in_array($status, self::STATUSES, true);
    }
}
