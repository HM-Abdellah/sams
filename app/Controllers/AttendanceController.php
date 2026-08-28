<?php
declare(strict_types=1);
namespace SAMS\Controllers;

use SAMS\Helpers\Validation;
use SAMS\Services\AttendanceService;

final class AttendanceController
{
    public function __construct(private readonly AttendanceService $service = new AttendanceService()) {}
    public function validatePayload(array $input): array
    {
        return ['student_id'=>Validation::id($input['student_id']??null,'student_id'),'attendance_date'=>Validation::date($input['attendance_date']??null,'attendance_date'),'period'=>Validation::id($input['period']??null,'period'),'status'=>Validation::enum($input['status']??null,'status',AttendanceService::STATUSES)];
    }
}
