<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Helpers\Validation;

final class ReportController
{
    public function validate(array $input): array
    {
        return [
            'class_id' => Validation::id($input['class_id'] ?? null, 'class_id'),
            'month' => Validation::month($input['month'] ?? null),
        ];
    }
}
