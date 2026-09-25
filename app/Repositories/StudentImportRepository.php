<?php

declare(strict_types=1);

namespace SAMSRepositories;

use SAMS\Helpers\Database;

final class StudentImportRepository
{
    public function createBatch(
        int $classId,
        int $createdBy,
        string $filename,
        string $sha256,
        int $fileSize,
        int $totalRows,
        int $validRows,
        int $warningRows,
        int $errorRows,
        string $status
    ): int {
        $stmt = Database::connection()->prepare(
            'INSERT INTO student_import_batches
                (class_id, created_by, original_filename, file_sha256, file_size,
                 status, total_rows, valid_rows, warning_rows, error_rows)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        $stmt->execute([
            $classId,
            $createdBy,
            $filename,
            $sha256,
            $fileSize,
            $status,
            $totalRows,
            $validRows,
            $warningRows,
            $errorRows,
        ]);

        return (int)Database::connection()->lastInsertId();
    }

    public function createRow(
        int $batchId,
        int $rowNumber,
        ?string $firstName,
        ?string $lastName,
        ?string $massarCode,
        ?string $birthDate,
        ?string $studentNumber,
        string $status,
        array $issues,
        array $rawData
    ): int {
        $stmt = Database::connection()->prepare(
            'INSERT INTO student_import_rows
                (batch_id, row_number, first_name, last_name, massar_code,
                 birth_date, student_number, status, issues, raw_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        $stmt->execute([
            $batchId,
            $rowNumber,
            $firstName,
            $lastName,
            $massarCode,
            $birthDate,
            $studentNumber,
            $status,
            json_encode($issues, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            json_encode($rawData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
        ]);

        return (int)Database::connection()->lastInsertId();
    }

    public function forClass(int $classId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                id, class_id, created_by, original_filename, file_sha256, file_size,
                status, total_rows, valid_rows, warning_rows, error_rows,
                imported_at, created_at, updated_at
             FROM student_import_batches
             WHERE class_id = ?
             ORDER BY id DESC'
        );
        $stmt->execute([$classId]);

        return $stmt->fetchAll();
    }

    public function findBatch(int $batchId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                id, class_id, created_by, original_filename, file_sha256, file_size,
                status, total_rows, valid_rows, warning_rows, error_rows,
                imported_at, created_at, updated_at
             FROM student_import_batches
             WHERE id = ?
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
                id, class_id, created_by, original_filename, file_sha256, file_size,
                status, total_rows, valid_rows, warning_rows, error_rows,
                imported_at, created_at, updated_at
             FROM student_import_batches
             WHERE id = ?
             LIMIT 1
             FOR UPDATE'
        );
        $stmt->execute([$batchId]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function forBatch(int $batchId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT
                id, batch_id, row_number, first_name, last_name, massar_code,
                birth_date, student_number, status, issues, raw_data, student_id,
                created_at, updated_at
             FROM student_import_rows
             WHERE batch_id = ?
             ORDER BY row_number'
        );
        $stmt->execute([$batchId]);

        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['issues'] = $this->decodeJsonArray($row['issues'] ?? null);
            $row['raw_data'] = $this->decodeJsonArray($row['raw_data'] ?? null);
        }
        unset($row);

        return $rows;
    }

    public function updateRow(
        int $batchId,
        int $rowId,
        ?string $firstName,
        ?string $lastName,
        ?string $massarCode,
        ?string $birthDate,
        ?string $studentNumber,
        string $status,
        array $issues,
        array $rawData
    ): bool {
        $stmt = Database::connection()->prepare(
            'UPDATE student_import_rows
             SET first_name = ?,
                 last_name = ?,
                 massar_code = ?,
                 birth_date = ?,
                 student_number = ?,
                 status = ?,
                 issues = ?,
                 raw_data = ?,
                 student_id = NULL
             WHERE id = ? AND batch_id = ?'
        );

        $stmt->execute([
            $firstName,
            $lastName,
            $massarCode,
            $birthDate,
            $studentNumber,
            $status,
            json_encode($issues, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            json_encode($rawData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            $rowId,
            $batchId,
        ]);

        return true;
    }

    public function updateStats(
        int $batchId,
        int $totalRows,
        int $validRows,
        int $warningRows,
        int $errorRows,
        string $status
    ): void {
        $stmt = Database::connection()->prepare(
            "UPDATE student_import_batches
             SET status = ?,
                 total_rows = ?,
                 valid_rows = ?,
                 warning_rows = ?,
                 error_rows = ?,
                 imported_at = CASE WHEN ? = 'imported' THEN CURRENT_TIMESTAMP ELSE imported_at END
             WHERE id = ?"
        );

        $stmt->execute([
            $status,
            $totalRows,
            $validRows,
            $warningRows,
            $errorRows,
            $status,
            $batchId,
        ]);
    }

    public function markRowImported(int $batchId, int $rowId, int $studentId): void
    {
        $stmt = Database::connection()->prepare(
            "UPDATE student_import_rows
             SET status = 'imported', student_id = ?, issues = NULL
             WHERE id = ? AND batch_id = ?"
        );
        $stmt->execute([$studentId, $rowId, $batchId]);
    }

    public function deleteBatch(int $batchId): void
    {
        $stmt = Database::connection()->prepare(
            'DELETE FROM student_import_batches
             WHERE id = ?'
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
