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
        $studentId = Validation::id($input['student_id'] ?? null, 'student_id');
        $date = Validation::date($input['attendance_date'] ?? null, 'attendance_date');
        $period = Validation::period($input['period'] ?? null);
        $status = Validation::enum($input['status'] ?? 'present', 'status', AttendanceService::STATUSES);
        $this->service->validate($studentId, $date, $period, $status);
        return ['student_id'=>$studentId,'attendance_date'=>$date,'period'=>$period,'status'=>$status];
    }
}
