<?php

declare(strict_types=1);

namespace SAMS\Services;

use DateTimeImmutable;
use InvalidArgumentException;

final class ReportService
{
    public function monthRange(string $month): array
    {
        if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) throw new InvalidArgumentException('Invalid month.');
        $start = new DateTimeImmutable($month . '-01');
        return [$start->format('Y-m-d'), $start->format('Y-m-t')];
    }

    public function weekRange(string $start): array
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $start);
        if (!$date || $date->format('Y-m-d') !== $start) throw new InvalidArgumentException('Invalid date.');
        return [$start, $date->modify('+5 days')->format('Y-m-d')];
    }
}
