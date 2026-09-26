<?php

declare(strict_types=1);

namespace SAMS\Services;

use DateTimeImmutable;
use InvalidArgumentException;

final class AcademicYearService
{
    public function validateName(string $name): string
    {
        $name = trim((string)(preg_replace('/\s+/u', ' ', $name) ?? ''));
        if ($name === '' || mb_strlen($name) > 20) {
            throw new InvalidArgumentException('Invalid academic year name.');
        }
        return $name;
    }

    public function validateDate(string $value, string $field): string
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) {
            throw new InvalidArgumentException("Invalid {$field}.");
        }
        return $value;
    }

    public function validateRange(string $startsOn, string $endsOn): array
    {
        $start = $this->validateDate($startsOn, 'starts_on');
        $end = $this->validateDate($endsOn, 'ends_on');

        if ($start >= $end) {
            throw new InvalidArgumentException('Academic year start must be before its end.');
        }

        return [$start, $end];
    }
}
