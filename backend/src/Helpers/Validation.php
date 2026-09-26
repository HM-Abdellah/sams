<?php

declare(strict_types=1);

namespace SAMS\Helpers;

final class Validation
{
    public static function requiredString(mixed $value, string $field, int $max = 255): string
    {
        if (!is_string($value)) Response::error("{$field} is required.", 422);
        $value = trim($value);
        if ($value === '' || mb_strlen($value) > $max) Response::error("Invalid {$field}.", 422);
        return $value;
    }

    public static function optionalString(mixed $value, string $field, int $max = 255): ?string
    {
        if ($value === null) return null;
        if (!is_string($value)) Response::error("Invalid {$field}.", 422);
        $value = trim($value);
        if ($value === '') return null;
        if (mb_strlen($value) > $max) Response::error("Invalid {$field}.", 422);
        return $value;
    }

    public static function id(mixed $value, string $field): int
    {
        $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($id === false) Response::error("Invalid {$field}.", 422);
        return (int)$id;
    }

    public static function date(mixed $value, string $field): string
    {
        $value = is_string($value) ? $value : '';
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) Response::error("Invalid {$field}.", 422);
        return $value;
    }

    public static function month(mixed $value, string $field = 'month'): string
    {
        $value = is_string($value) ? $value : '';
        if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $value)) Response::error("Invalid {$field}.", 422);
        return $value;
    }

    public static function period(mixed $value): int
    {
        $period = self::id($value, 'period');
        if ($period < 1 || $period > 8) Response::error('Invalid period.', 422);
        return $period;
    }

    public static function enum(mixed $value, string $field, array $allowed): string
    {
        $value = is_string($value) ? $value : '';
        if (!in_array($value, $allowed, true)) Response::error("Invalid {$field}.", 422);
        return $value;
    }
}
