<?php

declare(strict_types=1);

namespace SAMS\Repositories;

use SAMS\Helpers\Database;

final class SchoolImportRepository
{
    public function findBatch(int $batchId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                b.id,
                b.created_by,
                u.full_name AS created_by_name,
                b.target_academic_year_id,
                ay.name AS target_academic_year_name,
                b.source_academic_year,
                b.original_filename,
                b.file_sha256,
                b.file_size,
                b.status,
                b.total_classes,
                b.valid_classes,
                b.warning_classes,
                b.error_classes,
                b.total_rows,
                b.valid_rows,
                b.warning_rows,
                b.error_rows,
                b.imported_at,
                b.created_at,
                b.updated_at
             FROM school_import_batches b
             INNER JOIN users u ON u.id = b.created_by
             LEFT JOIN academic_years ay ON ay.id = b.target_academic_year_id
             WHERE b.id = ?
             LIMIT 1'
        );
        $stmt->execute([$batchId]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function findBatchForUpdate(int $batchId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                id,
                created_by,
                target_academic_year_id,
                source_academic_year,
                original_filename,
                file_sha256,
                file_size,
                status,
                total_classes,
                valid_classes,
                warning_classes,
                error_classes,
                total_rows,
                valid_rows,
                warning_rows,
                error_rows,
                imported_at,
                created_at,
                updated_at
             FROM school_import_batches
             WHERE id = ?
             LIMIT 1
             FOR UPDATE'
        );
        $stmt->execute([$batchId]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function findClassInBatch(int $importClassId, int $batchId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                id,
                batch_id,
                source_sheet,
                source_block_start_row,
                source_block_end_row,
                source_class_name,
                source_level,
                source_academic_year,
                target_class_id,
                status,
                student_count,
                issues,
                created_at,
                updated_at
             FROM school_import_classes
             WHERE id = ? AND batch_id = ?
             LIMIT 1'
        );
        $stmt->execute([$importClassId, $batchId]);
        $row = $stmt->fetch();
        if ($row === false) return null;

        $row['issues'] = $this->decodeJsonArray($row['issues'] ?? null);
        return $row;
    }

    public function classesForBatch(int $batchId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                id,
                batch_id,
                source_sheet,
                source_block_start_row,
                source_block_end_row,
                source_class_name,
                source_level,
                source_academic_year,
                target_class_id,
                status,
                student_count,
                issues,
                created_at,
                updated_at
             FROM school_import_classes
             WHERE batch_id = ?
             ORDER BY id'
        );
        $stmt->execute([$batchId]);

        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['issues'] = $this->decodeJsonArray($row['issues'] ?? null);
        }
        unset($row);

        return $rows;
    }

    public function rowsForBatch(int $batchId, bool $forUpdate = false): array
    {
        $sql = 'SELECT
                    r.id,
                    r.import_class_id,
                    r.source_row,
                    r.roster_number,
                    r.first_name,
                    r.last_name,
                    r.massar_code,
                    r.birth_date,
                    r.sex,
                    r.birth_place,
                    r.status,
                    r.match_status,
                    r.issues,
                    r.matched_student_id,
                    r.target_enrollment_id,
                    c.source_class_name,
                    c.source_sheet,
                    c.target_class_id,
                    c.status AS import_class_status
                FROM school_import_rows r
                INNER JOIN school_import_classes c ON c.id = r.import_class_id
                WHERE c.batch_id = ?
                ORDER BY r.import_class_id, r.source_row';

        if ($forUpdate) {
            $sql .= ' FOR UPDATE';
        }

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute([$batchId]);

        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['issues'] = $this->decodeJsonArray($row['issues'] ?? null);
        }
        unset($row);

        return $rows;
    }

    public function rowsForClass(int $importClassId, int $page = 1, int $perPage = 50): array
    {
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $offset = ($page - 1) * $perPage;

        $countStmt = Database::connection()->prepare(
            'SELECT COUNT(*) FROM school_import_rows WHERE import_class_id = ?'
        );
        $countStmt->execute([$importClassId]);
        $total = (int)$countStmt->fetchColumn();

        $stmt = Database::connection()->prepare(
            "SELECT
                id,
                import_class_id,
                source_row,
                roster_number,
                first_name,
                last_name,
                massar_code,
                birth_date,
                sex,
                birth_place,
                status,
                match_status,
                issues,
                matched_student_id,
                target_enrollment_id,
                created_at,
                updated_at
             FROM school_import_rows
             WHERE import_class_id = ?
             ORDER BY source_row
             LIMIT {$perPage} OFFSET {$offset}"
        );
        $stmt->execute([$importClassId]);

        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['issues'] = $this->decodeJsonArray($row['issues'] ?? null);
        }
        unset($row);

        return [
            'rows' => $rows,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'pages' => $total === 0 ? 0 : (int)ceil($total / $perPage),
        ];
    }

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

    public function createClass(int $batchId, array $class): int
    {
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

    public function updateClassMapping(
        int $batchId,
        int $importClassId,
        ?int $targetClassId,
        string $status,
        array $issues
    ): void {
        $stmt = Database::connection()->prepare(
            'UPDATE school_import_classes
             SET target_class_id = ?,
                 status = ?,
                 issues = ?
             WHERE id = ? AND batch_id = ?'
        );

        $stmt->execute([
            $targetClassId,
            $status,
            $issues === [] ? null : json_encode(array_values(array_unique($issues)), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            $importClassId,
            $batchId,
        ]);
    }

    public function updateRowMatch(
        int $batchId,
        int $rowId,
        string $status,
        string $matchStatus,
        ?int $matchedStudentId,
        ?int $targetEnrollmentId,
        array $issues
    ): void {
        $stmt = Database::connection()->prepare(
            'UPDATE school_import_rows
             SET status = ?,
                 match_status = ?,
                 matched_student_id = ?,
                 target_enrollment_id = ?,
                 issues = ?
             WHERE id = ?
               AND import_class_id IN (
                   SELECT id FROM school_import_classes WHERE batch_id = ?
               )'
        );

        $stmt->execute([
            $status,
            $matchStatus,
            $matchedStudentId,
            $targetEnrollmentId,
            $issues === [] ? null : json_encode(array_values(array_unique($issues)), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            $rowId,
            $batchId,
        ]);
    }

    public function markRowImported(
        int $batchId,
        int $rowId,
        int $studentId,
        int $enrollmentId
    ): void {
        $stmt = Database::connection()->prepare(
            "UPDATE school_import_rows
             SET status = 'imported',
                 matched_student_id = ?,
                 target_enrollment_id = ?,
                 issues = NULL
             WHERE id = ?
               AND import_class_id IN (
                   SELECT id FROM school_import_classes WHERE batch_id = ?
               )"
        );
        $stmt->execute([$studentId, $enrollmentId, $rowId, $batchId]);
    }

    public function markClassImported(int $batchId, int $importClassId): void
    {
        $stmt = Database::connection()->prepare(
            "UPDATE school_import_classes
             SET status = 'imported'
             WHERE id = ? AND batch_id = ?"
        );
        $stmt->execute([$importClassId, $batchId]);
    }

    public function markBatchImported(int $batchId): void
    {
        $stmt = Database::connection()->prepare(
            "UPDATE school_import_batches
             SET status = 'imported',
                 imported_at = CURRENT_TIMESTAMP
             WHERE id = ?"
        );
        $stmt->execute([$batchId]);
    }

    private function decodeJsonArray(mixed $value): ?array
    {
        if (!is_string($value) || $value === '') return null;

        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : null;
    }
}
