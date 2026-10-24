<?php

declare(strict_types=1);

namespace SAMS\Services;

use SAMS\Exceptions\SchoolImportWorkflowException;
use SAMS\Helpers\Database;
use SAMS\Repositories\AcademicYearRepository;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\ClassRepository;
use SAMS\Repositories\SchoolImportRepository;
use SAMS\Repositories\StudentEnrollmentRepository;
use SAMS\Repositories\StudentRepository;
use Throwable;

final class SchoolWorkbookImportReconciliationService
{
    private const RECONCILIATION_ISSUES = [
        'target_academic_year_required',
        'target_class_not_found',
        'staged_row_not_validated',
        'target_class_number_conflict',
        'identity_conflict_first_name',
        'identity_conflict_last_name',
        'identity_conflict_birth_date',
        'student_enrollment_conflict',
        'multiple_enrollments_in_target_academic_year',
        'student_data_changed_since_reconciliation',
        'target_class_changed_since_reconciliation',
        'student_massar_owned_by_another_school',
    ];

    private const NON_BLOCKING_ISSUES = [
        'duplicate_roster_number_in_class',
    ];

    public function __construct(
        private readonly SchoolImportRepository $imports = new SchoolImportRepository(),
        private readonly AcademicYearRepository $academicYears = new AcademicYearRepository(),
        private readonly ClassRepository $classes = new ClassRepository(),
        private readonly StudentRepository $students = new StudentRepository(),
        private readonly StudentEnrollmentRepository $enrollments = new StudentEnrollmentRepository(),
        private readonly AuditLogRepository $audit = new AuditLogRepository(),
    ) {}

    /**
     * Resolve source classes to exact target-year classes and reconcile students by Massar.
     * This changes staging only; production students/enrollments are untouched.
     *
     * @return array<string,mixed>
     */
    public function reconcile(int $batchId, int $userId, ?int $schoolId = null): array
    {
        if ($batchId < 1 || $userId < 1) {
            throw new \InvalidArgumentException('Invalid school import reconciliation request.');
        }
        $schoolId = $this->requireSchoolId($schoolId);

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $batch = $this->imports->findBatchForUpdate($batchId, $schoolId);
            if ($batch === null) {
                throw new SchoolImportWorkflowException('School import batch not found.');
            }

            if ($batch['status'] === 'imported') {
                $pdo->commit();

                return [
                    'batch_id' => $batchId,
                    'ready_to_import' => true,
                    'already_imported' => true,
                    'summary' => $this->summaryFromStoredBatch($batch),
                ];
            }

            if ($batch['status'] !== 'validated') {
                throw new SchoolImportWorkflowException(
                    'The workbook must pass parser validation before reconciliation.'
                );
            }

            $targetAcademicYearId = (int)($batch['target_academic_year_id'] ?? 0);
            if ($targetAcademicYearId < 1) {
                throw new \InvalidArgumentException(
                    'A target academic year must be selected before reconciliation.'
                );
            }

            $academicYear = $this->academicYears->find($targetAcademicYearId, $schoolId);
            if ($academicYear === null) {
                throw new SchoolImportWorkflowException('Target academic year no longer exists.');
            }

            $classes = $this->imports->classesForBatch($batchId);
            $rows = $this->imports->rowsForBatch($batchId, true);

            $classContext = [];
            $readyClassCount = 0;
            $errorClassCount = 0;

            foreach ($classes as $class) {
                $issues = $this->withoutReconciliationIssues($class['issues'] ?? []);
                $sourceName = trim((string)($class['source_class_name'] ?? ''));

                $target = null;
                if ($sourceName !== '') {
                    $target = $this->classes->findByAcademicYearAndName(
                        $targetAcademicYearId,
                        $sourceName,
                        $schoolId
                    );
                }

                if ($target === null) {
                    if ($sourceName === '') {
                        $issues[] = 'target_class_not_found';
                        $this->imports->updateClassMapping(
                            $batchId,
                            (int)$class['id'],
                            null,
                            'error',
                            $issues
                        );
                        ++$errorClassCount;
                        $classContext[(int)$class['id']] = [
                            'source' => $class,
                            'target' => null,
                            'create_on_commit' => false,
                        ];
                        continue;
                    }

                    // A whole-school import must also be able to seed classes in a
                    // new academic year. Resolve the mapping in staging, but defer
                    // creating the real class until the atomic Commit transaction.
                    $this->imports->updateClassMapping(
                        $batchId,
                        (int)$class['id'],
                        null,
                        'mapped',
                        $issues
                    );
                    ++$readyClassCount;
                    $classContext[(int)$class['id']] = [
                        'source' => $class,
                        'target' => null,
                        'create_on_commit' => true,
                    ];
                    continue;
                }

                $this->imports->updateClassMapping(
                    $batchId,
                    (int)$class['id'],
                    (int)$target['id'],
                    'mapped',
                    $issues
                );
                ++$readyClassCount;

                $classContext[(int)$class['id']] = [
                    'source' => $class,
                    'target' => $target,
                    'create_on_commit' => false,
                ];
            }

            $massars = [];
            $rowsByClass = [];
            foreach ($rows as $row) {
                $classId = (int)$row['import_class_id'];
                $rowsByClass[$classId][] = $row;

                if (
                    (
                        ($classContext[$classId]['target'] ?? null) !== null
                        || ($classContext[$classId]['create_on_commit'] ?? false) === true
                    )
                    && in_array(($row['status'] ?? ''), ['valid', 'warning'], true)
                ) {
                    $massar = trim((string)($row['massar_code'] ?? ''));
                    if ($massar !== '') $massars[] = $massar;
                }
            }

            $existingStudents = $this->students->studentsByMassarCodes($massars, $schoolId);
            $foreignMassars = $this->students->massarCodesOwnedByOtherSchools($massars, $schoolId);
            $existingStudentIds = array_values(array_unique(array_map(
                static fn(array $student): int => (int)$student['id'],
                array_values($existingStudents)
            )));
            $yearEnrollments = $this->groupEnrollments(
                $this->enrollments->forStudentsInAcademicYear(
                    $existingStudentIds,
                    $targetAcademicYearId
                )
            );

            $conflictRows = 0;
            $newRows = 0;
            $existingRows = 0;

            foreach ($rowsByClass as $importClassId => $classRows) {
                $context = $classContext[$importClassId] ?? null;
                $target = is_array($context['target'] ?? null) ? $context['target'] : null;

                $createOnCommit = ($context['create_on_commit'] ?? false) === true;
                if ($target === null && !$createOnCommit) {
                    foreach ($classRows as $row) {
                        $this->imports->updateRowMatch(
                            $batchId,
                            (int)$row['id'],
                            'error',
                            'conflict',
                            null,
                            null,
                            array_values(array_unique(array_merge(
                                $this->withoutReconciliationIssues($row['issues'] ?? []),
                                ['target_class_not_found']
                            )))
                        );
                        ++$conflictRows;
                    }
                    continue;
                }

                $classHasRowConflict = false;

                foreach ($classRows as $row) {
                    $issues = $this->withoutReconciliationIssues($row['issues'] ?? []);
                    $matchedStudentId = null;
                    $targetEnrollmentId = null;
                    $matchStatus = 'new';

                    if (!in_array(($row['status'] ?? ''), ['valid', 'warning'], true)) {
                        $issues[] = 'staged_row_not_validated';
                    } else {
                        $massar = trim((string)($row['massar_code'] ?? ''));
                        $student = $existingStudents[$this->massarKey($massar)] ?? null;

                        if ($student === null) {
                            if (isset($foreignMassars[$this->massarKey($massar)])) {
                                $issues[] = 'student_massar_owned_by_another_school';
                            } else {
                                ++$newRows;
                                $matchStatus = 'new';
                            }
                        } else {
                            ++$existingRows;
                            $matchedStudentId = (int)$student['id'];
                            $matchStatus = 'existing';

                            $this->addIdentityIssues($issues, $student, $row);

                            $enrollmentList = $yearEnrollments[$matchedStudentId] ?? [];
                            if ($target === null) {
                                // Until Commit creates a new class, any existing
                                // enrollment in this target year belongs elsewhere.
                                if (count($enrollmentList) === 1) {
                                    $issues[] = 'student_enrollment_conflict';
                                } elseif (count($enrollmentList) > 1) {
                                    $issues[] = 'multiple_enrollments_in_target_academic_year';
                                }
                            } elseif (count($enrollmentList) === 1) {
                                if ((int)$enrollmentList[0]['class_id'] === (int)$target['id']) {
                                    $targetEnrollmentId = (int)$enrollmentList[0]['id'];
                                } else {
                                    $issues[] = 'student_enrollment_conflict';
                                }
                            } elseif (count($enrollmentList) > 1) {
                                $issues[] = 'multiple_enrollments_in_target_academic_year';
                            }
                        }

                    }

                    $issues = array_values(array_unique($issues));
                    $blockingIssues = $this->withoutNonBlockingIssues($issues);
                    if ($blockingIssues !== []) {
                        $matchStatus = 'conflict';
                        $status = 'error';
                        ++$conflictRows;
                        $classHasRowConflict = true;
                    } else {
                        $status = 'matched';
                    }

                    $this->imports->updateRowMatch(
                        $batchId,
                        (int)$row['id'],
                        $status,
                        $matchStatus,
                        $matchedStudentId,
                        $targetEnrollmentId,
                        $issues
                    );
                }

                if ($classHasRowConflict) {
                    $classIssues = $this->withoutReconciliationIssues($context['source']['issues'] ?? []);
                    $classIssues[] = 'student_reconciliation_conflict';
                    $this->imports->updateClassMapping(
                        $batchId,
                        $importClassId,
                        $target === null ? null : (int)$target['id'],
                        'error',
                        $classIssues
                    );
                    --$readyClassCount;
                    ++$errorClassCount;
                }
            }

            $ready = $errorClassCount === 0 && $conflictRows === 0 && $readyClassCount === count($classes);
            $auditSummary = [
                'ready_to_import' => $ready,
                'target_academic_year_id' => $targetAcademicYearId,
                'class_count' => count($classes),
                'mapped_classes' => $readyClassCount,
                'class_conflicts' => $errorClassCount,
                'new_students' => $newRows,
                'existing_students' => $existingRows,
                'conflict_rows' => $conflictRows,
            ];

            $this->audit->record(
                $userId,
                'school_import.reconcile',
                'school_import_batch',
                $batchId,
                $auditSummary
            );

            $pdo->commit();

            return [
                'batch_id' => $batchId,
                'ready_to_import' => $ready,
                'already_imported' => false,
                'summary' => $auditSummary,
            ];
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Commit a reconciled workbook atomically.
     *
     * @return array<string,mixed>
     */
    public function commit(int $batchId, int $userId, ?int $schoolId = null): array
    {
        if ($batchId < 1 || $userId < 1) {
            throw new \InvalidArgumentException('Invalid school import request.');
        }
        $schoolId = $this->requireSchoolId($schoolId);

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $batch = $this->imports->findBatchForUpdate($batchId, $schoolId);
            if ($batch === null) {
                throw new SchoolImportWorkflowException('School import batch not found.');
            }

            if ($batch['status'] === 'imported') {
                $pdo->commit();

                return [
                    'batch_id' => $batchId,
                    'already_imported' => true,
                    'summary' => [
                        'student_count' => (int)$batch['total_rows'],
                        'new_students' => 0,
                        'existing_students' => 0,
                        'enrollments_created' => 0,
                    ],
                ];
            }

            if ($batch['status'] !== 'validated') {
                throw new SchoolImportWorkflowException(
                    'The workbook is not in a validated state.'
                );
            }

            $targetAcademicYearId = (int)($batch['target_academic_year_id'] ?? 0);
            if ($targetAcademicYearId < 1) {
                throw new \InvalidArgumentException(
                    'A target academic year must be selected before import.'
                );
            }

            $academicYear = $this->academicYears->find($targetAcademicYearId, $schoolId);
            if ($academicYear === null) {
                throw new SchoolImportWorkflowException('Target academic year no longer exists.');
            }

            $classes = $this->imports->classesForBatch($batchId);
            $rows = $this->imports->rowsForBatch($batchId, true);

            if ($classes === []) {
                throw new SchoolImportWorkflowException('The import batch contains no classes.');
            }

            foreach ($classes as $class) {
                if (
                    ($class['status'] ?? '') !== 'mapped'
                    || (
                        (int)($class['target_class_id'] ?? 0) < 1
                        && trim((string)($class['source_class_name'] ?? '')) === ''
                    )
                ) {
                    throw new SchoolImportWorkflowException(
                        'All source classes must be mapped or ready for creation before import.'
                    );
                }
            }

            foreach ($rows as $row) {
                if (
                    ($row['status'] ?? '') !== 'matched'
                    || !in_array($row['match_status'] ?? '', ['new', 'existing'], true)
                    || trim((string)($row['massar_code'] ?? '')) === ''
                ) {
                    throw new SchoolImportWorkflowException(
                        'All student rows must be reconciled successfully before import.'
                    );
                }
            }

            $targetClasses = [];
            $targetClassByImportClassId = [];

            foreach ($classes as &$class) {
                $importClassId = (int)$class['id'];
                $sourceName = trim((string)($class['source_class_name'] ?? ''));
                $targetClassId = (int)($class['target_class_id'] ?? 0);

                if ($targetClassId > 0) {
                    $target = $this->classes->findForUpdate($targetClassId, $schoolId);
                    if (
                        $target === null
                        || (int)$target['academic_year_id'] !== $targetAcademicYearId
                        || trim((string)$target['name']) !== $sourceName
                    ) {
                        throw new SchoolImportWorkflowException(
                            'A target class changed or no longer matches the reconciled source class.'
                        );
                    }
                } else {
                    if ($sourceName === '') {
                        throw new SchoolImportWorkflowException(
                            'A source class has no name and cannot be created safely.'
                        );
                    }

                    // Reconcile only proposes missing classes. Create them here,
                    // inside the same transaction as students and enrollments, so
                    // any later validation failure rolls the whole operation back.
                    $target = $this->classes->findByAcademicYearAndName(
                        $targetAcademicYearId,
                        $sourceName,
                        $schoolId
                    );

                    if ($target === null) {
                        $sourceLevel = trim((string)($class['source_level'] ?? ''));
                        $level = $sourceLevel === ''
                            ? null
                            : mb_substr($sourceLevel, 0, 50);

                        try {
                            $targetClassId = $this->classes->create(
                                $targetAcademicYearId,
                                $sourceName,
                                $level,
                                null
                            );
                        } catch (\PDOException $e) {
                            // Handle a concurrent administrator creating the same
                            // class after Reconcile without duplicating the class.
                            if ((int)($e->errorInfo[1] ?? 0) !== 1062) {
                                throw $e;
                            }
                            $target = $this->classes->findByAcademicYearAndName(
                                $targetAcademicYearId,
                                $sourceName,
                                $schoolId
                            );
                            if ($target === null) {
                                throw $e;
                            }
                            $targetClassId = (int)$target['id'];
                        }

                        if ($target === null) {
                            $target = $this->classes->findForUpdate($targetClassId, $schoolId);
                        }
                    }

                    // Lock even a same-named class discovered at Commit time.
                    // This guards the school/year/name mapping until the
                    // enrollment and student writes commit.
                    if ($target !== null) {
                        $target = $this->classes->findForUpdate((int)$target['id'], $schoolId);
                    }

                    if (
                        $target === null
                        || (int)$target['academic_year_id'] !== $targetAcademicYearId
                        || trim((string)$target['name']) !== $sourceName
                    ) {
                        throw new SchoolImportWorkflowException(
                            'The target class could not be created or verified.'
                        );
                    }

                    $targetClassId = (int)$target['id'];
                    $this->imports->updateClassMapping(
                        $batchId,
                        $importClassId,
                        $targetClassId,
                        'mapped',
                        $this->withoutReconciliationIssues($class['issues'] ?? [])
                    );
                    $class['target_class_id'] = $targetClassId;
                }

                $targetClassByImportClassId[$importClassId] = $targetClassId;
                $targetClasses[$targetClassId] = $target;
            }
            unset($class);

            $massars = array_values(array_unique(array_filter(
                array_map(static fn(array $row): string => trim((string)$row['massar_code']), $rows),
                static fn(string $value): bool => $value !== ''
            )));
            $existingStudents = $this->students->studentsByMassarCodes($massars, $schoolId);

            $existingIds = array_values(array_unique(array_map(
                static fn(array $student): int => (int)$student['id'],
                array_values($existingStudents)
            )));
            $yearEnrollments = $this->groupEnrollments(
                $this->enrollments->forStudentsInAcademicYear(
                    $existingIds,
                    $targetAcademicYearId,
                    true
                )
            );

            $newStudents = 0;
            $existingStudentCount = 0;
            $enrollmentsCreated = 0;
            foreach ($rows as $row) {
                $importClassId = (int)$row['import_class_id'];
                $targetClassId = $targetClassByImportClassId[$importClassId] ?? 0;
                if ($targetClassId < 1 || !isset($targetClasses[$targetClassId])) {
                    throw new SchoolImportWorkflowException(
                        'A reconciled student row has no verified target class.'
                    );
                }

                $enrollmentId = null;
                $target = $targetClasses[$targetClassId];

                $massar = trim((string)$row['massar_code']);
                $student = $existingStudents[$this->massarKey($massar)] ?? null;

                if ($student === null) {
                    try {
                        $created = $this->students->createWithEnrollment(
                            $targetClassId,
                            null,
                            $massar,
                            trim((string)($row['birth_date'] ?? '')) !== ''
                                ? (string)$row['birth_date']
                                : null,
                            (string)$row['first_name'],
                            (string)$row['last_name'],
                            (string)$academicYear['starts_on']
                        );
                    } catch (Throwable $e) {
                        throw new SchoolImportWorkflowException(
                            'Student creation failed during the atomic import.',
                            0,
                            $e
                        );
                    }

                    $studentId = $created['student_id'];
                    $enrollmentId = $created['enrollment_id'];
                    ++$newStudents;
                    ++$enrollmentsCreated;

                    $existingStudents[$this->massarKey($massar)] = [
                        'id' => $studentId,
                        'class_id' => $targetClassId,
                        'student_number' => null,
                        'massar_code' => $massar,
                        'birth_date' => $row['birth_date'],
                        'first_name' => $row['first_name'],
                        'last_name' => $row['last_name'],
                        'status' => 'active',
                    ];
                } else {
                    $studentId = (int)$student['id'];
                    ++$existingStudentCount;

                    $lockedStudent = $this->students->findByIdForUpdate($studentId);
                    if ($lockedStudent === null) {
                        throw new SchoolImportWorkflowException(
                            'A matched student no longer exists.'
                        );
                    }

                    if (
                        $this->massarKey((string)$lockedStudent['massar_code']) !== $this->massarKey($massar)
                        || $this->normalizeIdentity((string)$lockedStudent['first_name']) !== $this->normalizeIdentity((string)$row['first_name'])
                        || $this->normalizeIdentity((string)$lockedStudent['last_name']) !== $this->normalizeIdentity((string)$row['last_name'])
                        || (
                            $row['birth_date'] !== null
                            && $lockedStudent['birth_date'] !== null
                            && (string)$lockedStudent['birth_date'] !== (string)$row['birth_date']
                        )
                    ) {
                        throw new SchoolImportWorkflowException(
                            'A matched student changed after reconciliation.'
                        );
                    }

                    $studentEnrollments = $yearEnrollments[$studentId] ?? [];
                    $targetEnrollmentId = null;

                    if (count($studentEnrollments) === 1) {
                        if ((int)$studentEnrollments[0]['class_id'] !== $targetClassId) {
                            throw new SchoolImportWorkflowException(
                                'A student is already enrolled in another class in the target academic year.'
                            );
                        }
                        $targetEnrollmentId = (int)$studentEnrollments[0]['id'];
                    } elseif (count($studentEnrollments) > 1) {
                        throw new SchoolImportWorkflowException(
                            'A student has multiple overlapping enrollments in the target academic year.'
                        );
                    } else {
                        $targetEnrollmentId = $this->enrollments->create(
                            $studentId,
                            $targetClassId,
                            (string)$academicYear['starts_on']
                        );
                        ++$enrollmentsCreated;
                    }

                    if ((int)($academicYear['is_active'] ?? 0) === 1) {
                        $this->students->updateCurrentClass(
                            $studentId,
                            $targetClassId
                        );
                    }
                }

                $committedEnrollmentId = $enrollmentId ?? $targetEnrollmentId ?? null;
                $rosterNumber = trim((string)($row['roster_number'] ?? ''));
                if ($committedEnrollmentId !== null && $rosterNumber !== '') {
                    $this->enrollments->setRosterNumber((int)$committedEnrollmentId, $rosterNumber);
                }

                $this->imports->updateRowMatch(
                    $batchId,
                    (int)$row['id'],
                    'imported',
                    (string)$row['match_status'],
                    $studentId,
                    $committedEnrollmentId,
                    []
                );

            }

            foreach ($classes as $class) {
                $this->imports->markClassImported($batchId, (int)$class['id']);
            }

            $this->imports->markBatchImported($batchId);

            $summary = [
                'student_count' => count($rows),
                'new_students' => $newStudents,
                'existing_students' => $existingStudentCount,
                'enrollments_created' => $enrollmentsCreated,
            ];

            $this->audit->record(
                $userId,
                'school_import.import',
                'school_import_batch',
                $batchId,
                $summary
            );

            $pdo->commit();

            return [
                'batch_id' => $batchId,
                'already_imported' => false,
                'summary' => $summary,
            ];
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    /** @return array<int,list<array<string,mixed>>> */
    private function groupEnrollments(array $enrollments): array
    {
        $result = [];
        foreach ($enrollments as $enrollment) {
            $studentId = (int)$enrollment['student_id'];
            $result[$studentId][] = $enrollment;
        }
        return $result;
    }

    private function addIdentityIssues(array &$issues, array $student, array $row): void
    {
        if (
            $this->normalizeIdentity((string)$student['first_name'])
            !== $this->normalizeIdentity((string)$row['first_name'])
        ) {
            $issues[] = 'identity_conflict_first_name';
        }

        if (
            $this->normalizeIdentity((string)$student['last_name'])
            !== $this->normalizeIdentity((string)$row['last_name'])
        ) {
            $issues[] = 'identity_conflict_last_name';
        }

        $sourceBirthDate = $row['birth_date'] ?? null;
        $storedBirthDate = $student['birth_date'] ?? null;
        if (
            $sourceBirthDate !== null
            && $storedBirthDate !== null
            && (string)$sourceBirthDate !== (string)$storedBirthDate
        ) {
            $issues[] = 'identity_conflict_birth_date';
        }
    }

    private function withoutReconciliationIssues(mixed $issues): array
    {
        if (!is_array($issues)) return [];

        return array_values(array_unique(array_filter(
            array_map(static fn($issue): string => (string)$issue, $issues),
            static fn(string $issue): bool => !in_array($issue, self::RECONCILIATION_ISSUES, true)
        )));
    }

    private function withoutNonBlockingIssues(mixed $issues): array
    {
        if (!is_array($issues)) return [];

        return array_values(array_unique(array_filter(
            array_map(static fn($issue): string => (string)$issue, $issues),
            static fn(string $issue): bool => !in_array($issue, self::NON_BLOCKING_ISSUES, true)
        )));
    }

    private function normalizeIdentity(string $value): string
    {
        return strtolower(trim(preg_replace('/\s+/u', ' ', $value) ?? $value));
    }

    private function massarKey(string $value): string
    {
        return strtolower(trim($value));
    }

    private function summaryFromStoredBatch(array $batch): array
    {
        return [
            'student_count' => (int)$batch['total_rows'],
            'new_students' => 0,
            'existing_students' => 0,
            'enrollments_created' => 0,
        ];
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
