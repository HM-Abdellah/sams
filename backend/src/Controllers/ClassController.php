<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Services\ClassService;

final class ClassController
{
    private ClassService $service;

    public function __construct(?ClassService $service = null)
    {
        $this->service = $service ?? new ClassService();
    }

    public function validateCreate(array $input): array
    {
        return [
            'name' => $this->service->normalizeName((string)($input['name'] ?? '')),
            'level' => $this->service->optionalText(isset($input['level']) ? (string)$input['level'] : null, 50),
            'branch' => $this->service->optionalText(isset($input['branch']) ? (string)$input['branch'] : null, 100),
        ];
    }
}
