<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Helpers\Validation;
use SAMS\Services\StudentService;

final class StudentController
{
    public function __construct(private readonly StudentService $service = new StudentService()) {}

    public function validateCreate(array $input): array
    {
        return [
            'first_name' => $this->service->validateName((string)($input['first_name'] ?? ''), 'first_name'),
            'last_name' => $this->service->validateName((string)($input['last_name'] ?? ''), 'last_name'),
            'student_number' => $this->service->normalizeNumber(isset($input['student_number']) ? (string)$input['student_number'] : null),
        ];
    }

    public function validateId(array $input): int
    {
        return Validation::id($input['id'] ?? null, 'id');
    }
}
