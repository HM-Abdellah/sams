<?php

declare(strict_types=1);

namespace SAMS\Services;

use DateTimeImmutable;
use SAMS\Exceptions\ArchiveReportException;
use SAMS\Repositories\ArchiveRepository;
use SAMS\Repositories\ClassRepository;

final class ArchiveService
{
    public function __construct(
        private readonly ArchiveRepository $archive = new ArchiveRepository(),
        private readonly ClassRepository $classes = new ClassRepository(),
        private readonly ReportService $reports = new ReportService(),
    ) {}

    public function read(
        int $userId,
        string $role,
        int $classId,
        string $view,
        ?string $month = null,
        ?string $date = null,
        ?int $studentId = null,
        ?int $schoolId = null
    ): array {
        if ($role !== 'admin') {
            throw new ArchiveReportException('Forbidden.', 403);
        }

        if (!$this->classes->hasHistoricalAccess($userId, $role, $classId, $schoolId)) {
            throw new ArchiveReportException('Forbidden.', 403);
        }

        if (!in_array($view, ['days', 'month', 'day', 'student'], true)) {
            throw new \InvalidArgumentException('Invalid archive view.');
        }

        $class = $this->archive->classInfo($classId, $schoolId);
        if ($class === null) {
            throw new ArchiveReportException('Class not found.', 404);
        }

        if ($view === 'student') {
            $studentId = $studentId ?? 0;
            if ($studentId < 1) {
                throw new \InvalidArgumentException('Invalid student.');
            }

            if (!$this->archive->studentInClass($studentId, $classId)) {
                throw new ArchiveReportException('Student history not found for this class.', 404);
            }

            return [
                'view' => 'student',
                'class' => $class,
                'student_id' => $studentId,
                'history' => $this->archive->studentHistory($studentId, $classId),
            ];
        }

        if ($view === 'day') {
            $value = $date ?? '';
            $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
            if (!$parsed || $parsed->format('Y-m-d') !== $value) {
                throw new \InvalidArgumentException('Invalid archive date.');
            }
            if ($value < $class['academic_year_starts_on'] || $value > $class['academic_year_ends_on']) {
                throw new \InvalidArgumentException('Archive date is outside the class academic year.');
            }

            return [
                'view' => 'day',
                'class' => $class,
                'date' => $value,
                'records' => $this->archive->daily($classId, $value),
            ];
        }

        $month = $month !== null && $month !== ''
            ? $month
            : substr((string)$class['academic_year_starts_on'], 0, 7);
        [$start, $end] = $this->reports->monthRange($month);

        if ($end < $class['academic_year_starts_on'] || $start > $class['academic_year_ends_on']) {
            throw new \InvalidArgumentException('Archive month is outside the class academic year.');
        }

        if ($view === 'month') {
            return [
                'view' => 'month',
                'class' => $class,
                'month' => $month,
                'start' => $start,
                'end' => $end,
                'students' => $this->archive->monthlyStudents($classId, $start, $end),
            ];
        }

        return [
            'view' => 'days',
            'class' => $class,
            'month' => $month,
            'start' => $start,
            'end' => $end,
            'days' => $this->archive->days($classId, $start, $end),
        ];
    }
}