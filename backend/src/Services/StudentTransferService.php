<?php

declare(strict_types=1);

namespace SAMS\Services;

use DateTimeImmutable;
use PDOException;
use SAMS\Exceptions\StudentWorkflowException;
use SAMS\Helpers\Database;
use SAMS\Repositories\AcademicYearRepository;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\ClassRepository;
use SAMS\Repositories\StudentEnrollmentRepository;
use SAMS\Repositories\StudentRepository;

final class StudentTransferService
{
    public function __construct(
        private readonly ClassRepository $classes = new ClassRepository(),
        private readonly StudentRepository $students = new StudentRepository(),
        private readonly StudentEnrollmentRepository $enrollments = new StudentEnrollmentRepository(),
        private readonly AcademicYearRepository $academicYears = new AcademicYearRepository(),
        private readonly AuditLogRepository $audit = new AuditLogRepository(),
    ) {}

    /** @return array{id:int,class_id:int,enrollment_id:int,effective_date:string} */
    public function transfer(
        int $userId,
        string $role,
        int $studentId,
        int $sourceClassId,
        int $targetClassId,
        string $effectiveDate
    ): array {
        if ($role !== 'admin') {
            throw new StudentWorkflowException('Forbidden.', 403);
        }
        if ($studentId < 1 || $sourceClassId < 1 || $targetClassId < 1) {
            throw new StudentWorkflowException('Invalid transfer parameters.', 422);
        }
        if ($sourceClassId === $targetClassId) {
            throw new StudentWorkflowException(
                'Target class must be different from the current class.',
                409
            );
        }

        $parsedDate = DateTimeImmutable::createFromFormat('!Y-m-d', trim($effectiveDate));
        if (!$parsedDate || $parsedDate->format('Y-m-d') !== trim($effectiveDate)) {
            throw new StudentWorkflowException('Invalid transfer effective date.', 422);
        }

        $effectiveDate = $parsedDate->format('Y-m-d');
        $endsOn = $parsedDate->modify('-1 day')->format('Y-m-d');
        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $lockedClasses = $this->lockClasses($sourceClassId, $targetClassId);
            $sourceClass = $lockedClasses[$sourceClassId];
            $targetClass = $lockedClasses[$targetClassId];

            if (!$this->classes->hasAccess($userId, 'admin', $sourceClassId)) {
                throw new StudentWorkflowException('Forbidden.', 403);
            }

            $student = $this->students->findByIdForUpdate($studentId);
            if (
                $student === null
                || (int)$student['class_id'] !== $sourceClassId
                || (string)$student['status'] !== 'active'
            ) {
                throw new StudentWorkflowException('Student not found.', 404);
            }

            $academicYear = $this->academicYears->find((int)$sourceClass['academic_year_id']);
            if ($academicYear === null) {
                throw new StudentWorkflowException('Academic year not found.', 422);
            }

            if (!(bool)$targetClass['is_active']) {
                throw new StudentWorkflowException('Target class is not active.', 409);
            }
            if ((int)$targetClass['academic_year_id'] !== (int)$sourceClass['academic_year_id']) {
                throw new StudentWorkflowException(
                    'Transfers must stay within the same academic year.',
                    409
                );
            }
            if (
                $effectiveDate < (string)$academicYear['starts_on']
                || $effectiveDate > (string)$academicYear['ends_on']
            ) {
                throw new StudentWorkflowException(
                    'Transfer date is outside the current academic year.',
                    422
                );
            }

            $currentEnrollment = $this->enrollments->currentForStudentForUpdate($studentId);
            if (
                $currentEnrollment === null
                || (int)$currentEnrollment['class_id'] !== $sourceClassId
            ) {
                throw new StudentWorkflowException(
                    'Current student enrollment could not be resolved.',
                    409
                );
            }

            if ($effectiveDate <= (string)$currentEnrollment['starts_on']) {
                throw new StudentWorkflowException(
                    'Transfer date must be after the current enrollment start date.',
                    422
                );
            }
            if ($this->enrollments->hasAttendanceOnOrAfter(
                (int)$currentEnrollment['id'],
                $effectiveDate
            )) {
                throw new StudentWorkflowException(
                    'Attendance already exists on or after the transfer date.',
                    409
                );
            }
            if ($this->enrollments->hasOverlappingEnrollment(
                $studentId,
                $effectiveDate,
                null,
                (int)$currentEnrollment['id']
            )) {
                throw new StudentWorkflowException(
                    'Student already has another enrollment overlapping the transfer date.',
                    409
                );
            }

            $studentNumber = trim((string)($student['student_number'] ?? ''));
            if ($studentNumber !== '') {
                $owners = $this->students->numberOwnersInClass($targetClassId, [$studentNumber]);
                if (isset($owners[$studentNumber])) {
                    throw new StudentWorkflowException(
                        'Student number is already used in the target class.',
                        409
                    );
                }
            }

            $this->enrollments->close((int)$currentEnrollment['id'], $endsOn);
            $newEnrollmentId = $this->enrollments->create(
                $studentId,
                $targetClassId,
                $effectiveDate
            );
            $this->students->transfer($studentId, $sourceClassId, $targetClassId);

            $this->audit->record(
                $userId,
                'student.transfer',
                'student',
                $studentId,
                [
                    'from_class_id' => $sourceClassId,
                    'to_class_id' => $targetClassId,
                    'effective_date' => $effectiveDate,
                    'previous_enrollment_id' => (int)$currentEnrollment['id'],
                    'new_enrollment_id' => $newEnrollmentId,
                ]
            );

            $pdo->commit();

            return [
                'id' => $studentId,
                'class_id' => $targetClassId,
                'enrollment_id' => $newEnrollmentId,
                'effective_date' => $effectiveDate,
            ];
        } catch (StudentWorkflowException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                throw new StudentWorkflowException(
                    'Student already has an enrollment starting on this date.',
                    409
                );
            }
            throw $e;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    /** @return array<int,array<string,mixed>> */
    private function lockClasses(int $sourceClassId, int $targetClassId): array
    {
        $ids = array_values(array_unique([$sourceClassId, $targetClassId]));
        sort($ids, SORT_NUMERIC);
        $locked = [];

        foreach ($ids as $classId) {
            $row = $this->classes->findForUpdate($classId);
            if ($row === null) {
                throw new StudentWorkflowException(
                    $classId === $targetClassId ? 'Target class not found.' : 'Current class not found.',
                    404
                );
            }
            $locked[$classId] = $row;
        }

        return $locked;
    }
}