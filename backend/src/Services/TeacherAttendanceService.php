<?php

declare(strict_types=1);

namespace SAMS\Services;

use SAMS\Exceptions\AttendanceWorkflowException;
use SAMS\Helpers\Database;
use SAMS\Repositories\AcademicYearRepository;
use SAMS\Repositories\AttendanceRepository;
use SAMS\Repositories\AttendanceSignoffRepository;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\ClassRepository;
use SAMS\Repositories\StudentRepository;

final class TeacherAttendanceService
{
    public function __construct(
        private readonly AttendanceRepository $attendance = new AttendanceRepository(),
        private readonly AcademicYearRepository $academicYears = new AcademicYearRepository(),
        private readonly AttendanceSignoffRepository $signoffs = new AttendanceSignoffRepository(),
        private readonly AuditLogRepository $audit = new AuditLogRepository(),
        private readonly ClassRepository $classes = new ClassRepository(),
        private readonly StudentRepository $students = new StudentRepository(),
        private readonly AttendanceService $validator = new AttendanceService(),
        private readonly ReportService $reports = new ReportService(),
    ) {}

    public function weeklyRegister(
        int $userId,
        string $role,
        int $classId,
        string $weekStart,
        ?int $schoolId = null
    ): array {
        $this->assertAccess($userId, $role, $classId, $schoolId);

        $class = $this->classes->find($classId, $schoolId);
        if ($class === null) {
            throw new AttendanceWorkflowException('Class not found.', 404);
        }

        [$start, $end] = $this->reports->weekRange($weekStart);
        $yearStart = (string)$class['academic_year_starts_on'];
        $yearEnd = (string)$class['academic_year_ends_on'];

        if ($end < $yearStart || $start > $yearEnd) {
            return [
                'class_id' => $classId,
                'week_start' => $start,
                'week_end' => $end,
                'students' => [],
                'attendance' => [],
                'period_signoffs' => [],
            ];
        }

        $start = max($start, $yearStart);
        $end = min($end, $yearEnd);

        $students = [];
        foreach ($this->students->forClass($classId) as $student) {
            if ((string)$student['status'] !== 'active') {
                continue;
            }

            $students[] = [
                'id' => (int)$student['id'],
                'first_name' => (string)$student['first_name'],
                'last_name' => (string)$student['last_name'],
            ];
        }
        $attendance = [];
        foreach ($this->attendance->forClassRange($classId, $start, $end) as $row) {
            $attendance[] = [
                'id' => (int)$row['id'],
                'student_id' => (int)$row['student_id'],
                'enrollment_id' => (int)$row['enrollment_id'],
                'attendance_date' => (string)$row['attendance_date'],
                'period' => (int)$row['period'],
                'status' => (string)$row['status'],
            ];
        }

        return [
            'class_id' => $classId,
            'week_start' => $start,
            'week_end' => $end,
            'students' => $students,
            'attendance' => $attendance,
            'period_signoffs' => $this->signoffs->forWeek($classId, $start, $end),
        ];
    }

    public function saveBulk(
        int $userId,
        string $role,
        int $classId,
        array $entries,
        ?int $schoolId = null
    ): array {
        if (!in_array($role, ['admin', 'teacher'], true)) {
            throw new AttendanceWorkflowException('Forbidden.', 403);
        }

        $schoolId = $this->requireSchoolId($schoolId);

        $this->assertAccess($userId, $role, $classId, $schoolId);

        if ($entries === [] || count($entries) > 500) {
            throw new \InvalidArgumentException('Invalid attendance batch.');
        }

        $class = $this->classes->find($classId, $schoolId);
        if ($class === null) {
            throw new AttendanceWorkflowException('Class not found.', 404);
        }
        $academicYear = $this->academicYears->find(
            (int)$class['academic_year_id'],
            $schoolId
        );
        if ($academicYear === null) {
            throw new AttendanceWorkflowException('Academic year not found.', 422);
        }

        $normalized = [];
        $seen = [];
        $minDate = null;
        $maxDate = null;

        foreach ($entries as $index => $entry) {
            if (!is_array($entry)) {
                throw new \InvalidArgumentException('Invalid attendance batch entry.');
            }

            $studentId = (int)($entry['student_id'] ?? 0);
            $date = (string)($entry['attendance_date'] ?? '');
            $period = (int)($entry['period'] ?? 0);
            $action = (string)($entry['action'] ?? 'upsert');

            try {
                $this->validator->validateKey($studentId, $date, $period);
            } catch (\InvalidArgumentException $e) {
                throw new \InvalidArgumentException(
                    $e->getMessage() . ' Entry ' . $index . '.'
                );
            }

            if (
                $date < (string)$academicYear['starts_on']
                || $date > (string)$academicYear['ends_on']
            ) {
                throw new \InvalidArgumentException(
                    'Attendance date is outside the academic year.'
                );
            }

            if (!in_array($action, ['upsert', 'delete'], true)) {
                throw new \InvalidArgumentException('Invalid attendance action.');
            }

            $key = $studentId . ':' . $date . ':' . $period;
            if (isset($seen[$key])) {
                throw new \InvalidArgumentException(
                    'Duplicate attendance entry in batch.'
                );
            }
            $seen[$key] = true;

            $status = null;
            if ($action === 'upsert') {
                $status = (string)($entry['status'] ?? '');
                $this->validator->validate($studentId, $date, $period, $status);
            }

            $minDate = $minDate === null || $date < $minDate ? $date : $minDate;
            $maxDate = $maxDate === null || $date > $maxDate ? $date : $maxDate;
            $normalized[] = [
                'student_id' => $studentId,
                'attendance_date' => $date,
                'period' => $period,
                'action' => $action,
                'status' => $status,
            ];
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $lockedClass = $this->classes->findForUpdate($classId, $schoolId);
            if ($lockedClass === null) {
                throw new AttendanceWorkflowException('Class not found.', 404);
            }

            if (!$this->classes->hasAccess($userId, $role, $classId, $schoolId)) {
                throw new AttendanceWorkflowException('Forbidden.', 403);
            }

            $studentIds = array_values(array_unique(array_map(
                static fn(array $entry): int => (int)$entry['student_id'],
                $normalized
            )));
            sort($studentIds, SORT_NUMERIC);

            foreach ($studentIds as $studentId) {
                $student = $this->students->findByIdForUpdate($studentId);
                if (
                    $student === null
                    || (int)$student['class_id'] !== $classId
                    || (string)$student['status'] !== 'active'
                ) {
                    throw new AttendanceWorkflowException('Student not found.', 404);
                }
            }

            $existingRows = $this->attendance->forClassRange(
                $classId,
                $minDate,
                $maxDate,
                true
            );
            $existing = [];

            foreach ($existingRows as $row) {
                $key = (int)$row['student_id']
                    . ':' . (string)$row['attendance_date']
                    . ':' . (int)$row['period'];
                $existing[$key] = $row;
            }
            $signedRows = $this->signoffs->signedForClassRange(
                $classId,
                $minDate,
                $maxDate,
                true
            );
            $signed = [];

            foreach ($signedRows as $row) {
                $key = (string)$row['attendance_date'] . ':' . (int)$row['period'];
                $signed[$key] = true;
            }

            foreach ($normalized as $entry) {
                $key = $entry['attendance_date'] . ':' . $entry['period'];
                if (isset($signed[$key])) {
                    throw new AttendanceWorkflowException(
                        'This lesson is signed. Reopen it before correcting attendance.',
                        409
                    );
                }
            }

            $changed = 0;
            $unchanged = 0;
            $affectedPeriods = [];
            $affectedWeeks = [];

            foreach ($normalized as $entry) {
                $key = $entry['student_id']
                    . ':' . $entry['attendance_date']
                    . ':' . $entry['period'];
                $previous = $existing[$key] ?? null;

                if ($entry['action'] === 'delete') {
                    if ($previous === null) {
                        ++$unchanged;
                        continue;
                    }

                    $this->attendance->delete(
                        $entry['student_id'],
                        $entry['attendance_date'],
                        $entry['period'],
                        $classId,
                        true
                    );
                    $this->audit->record(
                        $userId,
                        'attendance.delete',
                        'attendance',
                        (int)$previous['id'],
                        [
                            'class_id' => $classId,
                            'student_id' => $entry['student_id'],
                            'attendance_date' => $entry['attendance_date'],
                            'period' => $entry['period'],
                            'previous_status' => $previous['status'],
                            'batch' => true,
                        ]
                    );
                    ++$changed;
                } elseif ($previous !== null && (string)$previous['status'] === $entry['status']) {
                    ++$unchanged;
                    continue;
                } else {
                    $this->attendance->upsert(
                        $entry['student_id'],
                        $entry['attendance_date'],
                        $entry['period'],
                        $entry['status'],
                        $userId,
                        $classId,
                        true
                    );

                    $this->audit->record(
                        $userId,
                        'attendance.upsert',
                        'attendance',
                        $previous ? (int)$previous['id'] : null,
                        [
                            'class_id' => $classId,
                            'student_id' => $entry['student_id'],
                            'attendance_date' => $entry['attendance_date'],
                            'period' => $entry['period'],
                            'previous_status' => $previous['status'] ?? null,
                            'status' => $entry['status'],
                            'batch' => true,
                        ]
                    );
                    ++$changed;
                }

                $affectedPeriods[$entry['attendance_date'] . ':' . $entry['period']] = [
                    'date' => $entry['attendance_date'],
                    'period' => $entry['period'],
                ];
                [$weekStart] = $this->reports->weekRange($entry['attendance_date']);
                $affectedWeeks[$weekStart] = true;
            }

            foreach ($affectedPeriods as $period) {
                $this->signoffs->invalidatePeriod(
                    $classId,
                    $period['date'],
                    $period['period'],
                    $userId
                );
            }

            foreach (array_keys($affectedWeeks) as $weekStart) {
                $this->signoffs->invalidateWeekSignature(
                    $classId,
                    $weekStart,
                    $userId
                );
                $this->signoffs->clearSubmission($classId, $weekStart);
            }

            $pdo->commit();

            return [
                'changed' => $changed,
                'unchanged' => $unchanged,
                'total' => count($normalized),
            ];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    private function assertAccess(int $userId, string $role, int $classId, ?int $schoolId = null): void
    {
        $this->assertSchoolIdWhenProvided($schoolId);

        if ($userId < 1 || $classId < 1) {
            throw new \InvalidArgumentException('Invalid attendance context.');
        }

        if (!$this->classes->hasAccess($userId, $role, $classId, $schoolId)) {
            throw new AttendanceWorkflowException('Forbidden.', 403);
        }
    }

    private function assertSchoolIdWhenProvided(?int $schoolId): void
    {
        if ($schoolId !== null && $schoolId < 1) {
            throw new \InvalidArgumentException('Invalid school.');
        }
    }

    private function requireSchoolId(?int $schoolId): int
    {
        if ($schoolId === null || $schoolId < 1) {
            throw new \InvalidArgumentException('Authenticated school scope is required.');
        }

        return $schoolId;
    }
}