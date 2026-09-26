<?php

declare(strict_types=1);

namespace SAMSRepositories;

use SAMSHelpersDatabase;

final class SchoolImportRepository
{
    public function createBatch(
        int $createdBy,
        ?int $targetAcademicYearId,
        ?string $sourceAcademicYear,
        string $filename,
        string $sha256,
        int $fileSize,
        string $status,
        array $summary
    ): int {
        $stmt = Database::connection()->prepare(
            'INSERT INTO school_import_batches
                (created_by, target_academic_year_id, source_academic_year,
                 original_filename, file_sha256, file_size, status,
                 total_classes, valid_classes, warning_classes, error_classes,
                 total_rows, valid_rows, warning_rows, error_rows)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        $stmt->execute([
            $createdBy,
            $targetAcademicYearId,
            $sourceAcademicYear,
            $filename,
            $sha256,
            $fileSize,
            $status,
            (int)($summary['class_count'] ?? 0),
            (int)($summary['valid_class_count'] ?? 0),
            (int)($summary['warning_class_count'] ?? 0),
            (int)($summary['error_class_count'] ?? 0),
            (int)($summary['student_count'] ?? 0),
            (int)($summary['valid_row_count'] ?? 0),
            (int)($summary['warning_row_count'] ?? 0),
            (int)($summary['error_row_count'] ?? 0),
        ]);

        return (int)Database::connection()->lastInsertId();
    }

    public function createClass(
        int $batchId,
        array $class
    ): int {
        $stmt = Database::connection()->prepare(
            'INSERT INTO school_import_classes
                (batch_id, source_sheet, source_block_start_row, source_block_end_row,
                 source_class_name, source_level, source_academic_year,
                 status, student_count, issues)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        $issues = $class['issues'] ?? [];
        $stmt->execute([
            $batchId,
            (string)($class['source_sheet'] ?? ''),
            max(1, (int)($class['source_block_start_row'] ?? 0)),
            isset($class['source_block_end_row']) ? max(
                max(1, (int)($class['source_block_start_row'] ?? 0)),
                (int)$class['source_block_end_row']
            ) : null,
            ($class['class_name'] ?? null) !== '' ? ($class['class_name'] ?? null) : null,
            ($class['level'] ?? null) !== '' ? ($class['level'] ?? null) : null,
            ($class['academic_year'] ?? null) !== '' ? ($class['academic_year'] ?? null) : null,
            (string)($class['status'] ?? 'error'),
            (int)($class['student_count'] ?? count($class['students'] ?? [])),
            $issues === [] ? null : json_encode($issues, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
        ]);

        return (int)Database::connection()->lastInsertId();
    }

    public function createRow(int $importClassId, array $student): int
    {
        $issues = is_array($student['issues'] ?? null) ? $student['issues'] : [];

        $stmt = Database::connection()->prepare(
            'INSERT INTO school_import_rows
                (import_class_id, source_row, roster_number, first_name, last_name,
                 massar_code, birth_date, sex, birth_place, status, match_status, issues)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        $stmt->execute([
            $importClassId,
            max(1, (int)($student['source_row'] ?? 0)),
            ($student['roster_number'] ?? null) !== '' ? ($student['roster_number'] ?? null) : null,
            $student['first_name'] ?? null,
            $student['last_name'] ?? null,
            $student['massar_code'] ?? null,
            $student['birth_date'] ?? null,
            $student['sex'] ?? null,
            $student['birth_place'] ?? null,
            (string)($student['status'] ?? 'error'),
            'not_checked',
            $issues === [] ? null : json_encode($issues, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
        ]);

        return (int)Database::connection()->lastInsertId();
    }
}
