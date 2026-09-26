<?php

declare(strict_types=1);

namespace SAMS\Services;

use InvalidArgumentException;
use SAMS\Helpers\Database;
use SAMS\Repositories\AcademicYearRepository;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\SchoolImportRepository;
use Throwable;

final class SchoolWorkbookImportStagingService
{
    public function __construct(
        private readonly SchoolWorkbookImportService $parser = new SchoolWorkbookImportService(),
        private readonly SchoolWorkbookImportValidationService $validator = new SchoolWorkbookImportValidationService(),
        private readonly SchoolImportRepository $imports = new SchoolImportRepository(),
        private readonly AcademicYearRepository $academicYears = new AcademicYearRepository(),
        private readonly AuditLogRepository $audit = new AuditLogRepository(),
    ) {}

    /**
     * Parse, validate and persist a workbook staging snapshot.
     * No production student/enrollment rows are created here.
     *
     * @return array<string,mixed>
     */
    public function stage(
        string $path,
        int $createdBy,
        string $filename,
        ?int $targetAcademicYearId = null
    ): array {
        if ($createdBy < 1) {
            throw new InvalidArgumentException('Invalid importing user.');
        }

        if ($targetAcademicYearId !== null) {
            if ($targetAcademicYearId < 1 || $this->academicYears->find($targetAcademicYearId) === null) {
                throw new InvalidArgumentException('Target academic year not found.');
            }
        }

        $parsed = $this->parser->parse($path);
        $validated = $this->validator->validate($parsed);

        $fileSize = filesize($path);
        $sha256 = hash_file('sha256', $path);
        if ($fileSize === false || $sha256 === false) {
            throw new InvalidArgumentException('Unable to fingerprint the uploaded workbook.');
        }

        $sourceYears = [];
        foreach ($validated['classes'] as $class) {
            $year = trim((string)($class['academic_year'] ?? ''));
            if ($year !== '') {
                $sourceYears[$year] = true;
            }
        }
        $sourceAcademicYear = count($sourceYears) === 1 ? array_key_first($sourceYears) : null;

        $classes = is_array($validated['classes'] ?? null) ? $validated['classes'] : [];
        $validClasses = 0;
        $warningClasses = 0;
        $errorClasses = 0;
        $validRows = 0;
        $warningRows = 0;
        $errorRows = 0;
        $totalRows = 0;

        foreach ($classes as $class) {
            $status = (string)($class['status'] ?? 'error');
            if ($status === 'valid') {
                ++$validClasses;
            } elseif ($status === 'warning') {
                ++$warningClasses;
            } else {
                ++$errorClasses;
            }

            $students = is_array($class['students'] ?? null) ? $class['students'] : [];
            $totalRows += count($students);
            foreach ($students as $student) {
                $status = (string)($student['status'] ?? 'error');
                if ($status === 'valid') {
                    ++$validRows;
                } elseif ($status === 'warning') {
                    ++$warningRows;
                } else {
                    ++$errorRows;
                }
            }
        }

        $status = ($validated['valid'] ?? false) ? 'validated' : 'staged';

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $batchId = $this->imports->createBatch(
                $createdBy,
                $targetAcademicYearId,
                $sourceAcademicYear,
                $this->normalizeFilename($filename),
                $sha256,
                $fileSize,
                $status,
                [
                    'class_count' => count($classes),
                    'valid_class_count' => $validClasses,
                    'warning_class_count' => $warningClasses,
                    'error_class_count' => $errorClasses,
                    'student_count' => $totalRows,
                    'valid_row_count' => $validRows,
                    'warning_row_count' => $warningRows,
                    'error_row_count' => $errorRows,
                ]
            );

            foreach ($classes as $class) {
                $importClassId = $this->imports->createClass($batchId, $class);

                foreach (($class['students'] ?? []) as $student) {
                    $this->imports->createRow($importClassId, $student);
                }
            }

            $this->audit->record(
                $createdBy,
                'school_import.stage',
                'school_import_batch',
                $batchId,
                [
                    'filename' => $this->normalizeFilename($filename),
                    'target_academic_year_id' => $targetAcademicYearId,
                    'source_academic_year' => $sourceAcademicYear,
                    'status' => $status,
                    'total_classes' => count($classes),
                    'total_rows' => $totalRows,
                    'error_rows' => $errorRows,
                ]
            );

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        return [
            'batch_id' => $batchId,
            'status' => $status,
            'source_academic_year' => $sourceAcademicYear,
            'target_academic_year_id' => $targetAcademicYearId,
            'summary' => [
                'class_count' => count($classes),
                'valid_class_count' => $validClasses,
                'warning_class_count' => $warningClasses,
                'error_class_count' => $errorClasses,
                'student_count' => $totalRows,
                'valid_row_count' => $validRows,
                'warning_row_count' => $warningRows,
                'error_row_count' => $errorRows,
            ],
            'workbook_issues' => $validated['workbook_issues'],
            'classes' => $validated['classes'],
            'sheets' => $parsed['sheets'],
        ];
    }

    private function normalizeFilename(string $filename): string
    {
        $filename = basename(trim($filename));

        if (
            $filename === ''
            || mb_strlen($filename) > 255
            || preg_match('/[\x00-\x1F\x7F]/', $filename) === 1
        ) {
            throw new InvalidArgumentException('Invalid workbook filename.');
        }

        return $filename;
    }
}
