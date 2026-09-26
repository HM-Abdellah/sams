<?php

declare(strict_types=1);

namespace SAMS\Services;

use InvalidArgumentException;
use RuntimeException;
use SAMS\Repositories\StudentRepository;

final class StudentImportService
{
    public const MAX_FILE_SIZE = 5_000_000;
    public const MAX_ROWS = 2_000;

    private const REQUIRED_HEADERS = [
        'first_name',
        'last_name',
        'massar_code',
        'birth_date',
    ];

    private const OPTIONAL_HEADERS = [
        'student_number',
    ];

    public function __construct(
        private readonly ?StudentService $students = null
    ) {}

    public function parseCsv(string $content): array
    {
        if ($content === '') {
            throw new InvalidArgumentException('The CSV file is empty.');
        }

        if (strlen($content) > self::MAX_FILE_SIZE) {
            throw new InvalidArgumentException('The CSV file is too large.');
        }

        $content = preg_replace('/^\xEF\xBB\xBF/', '', $content) ?? $content;

        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            throw new RuntimeException('Unable to open CSV parser.');
        }

        try {
            fwrite($handle, $content);
            rewind($handle);

            $headers = fgetcsv($handle);
            if (!is_array($headers)) {
                throw new InvalidArgumentException('The CSV file has no header row.');
            }

            $headers = $this->normalizeHeaders($headers);
            $headerMap = array_flip($headers);
            $allowedHeaders = array_merge(self::REQUIRED_HEADERS, self::OPTIONAL_HEADERS);

            foreach ($headers as $header) {
                if (!in_array($header, $allowedHeaders, true)) {
                    throw new InvalidArgumentException("Unsupported CSV column: {$header}.");
                }
            }

            foreach (self::REQUIRED_HEADERS as $header) {
                if (!isset($headerMap[$header])) {
                    throw new InvalidArgumentException("Missing required CSV column: {$header}.");
                }
            }

            $rows = [];
            $rowNumber = 1;

            while (($values = fgetcsv($handle)) !== false) {
                ++$rowNumber;

                if ($this->isBlankCsvRow($values)) {
                    continue;
                }

                if (count($rows) >= self::MAX_ROWS) {
                    throw new InvalidArgumentException('The CSV file contains too many student rows.');
                }

                if (count($values) > count($headers)) {
                    throw new InvalidArgumentException("CSV row {$rowNumber} contains more fields than the header.");
                }

                $raw = [];
                foreach ($headers as $index => $header) {
                    $raw[$header] = trim((string)($values[$index] ?? ''));
                }

                $rows[] = [
                    'row_number' => $rowNumber,
                    'raw_data' => $raw,
                    'data' => [
                        'first_name' => $raw['first_name'] ?? '',
                        'last_name' => $raw['last_name'] ?? '',
                        'massar_code' => $raw['massar_code'] ?? '',
                        'birth_date' => $raw['birth_date'] ?? '',
                        'student_number' => $raw['student_number'] ?? null,
                    ],
                ];
            }

            if ($rows === []) {
                throw new InvalidArgumentException('The CSV file contains no student rows.');
            }

            return $rows;
        } finally {
            fclose($handle);
        }
    }

    public function validateRows(array $parsedRows, ?array $existingMassarCodes = null, ?array $existingNumbers = null): array
    {
        $studentService = $this->students ?? new StudentService();
        $existingMassarCodes ??= [];
        $existingNumbers ??= [];

        $normalized = [];
        $massarSeen = [];
        $numberSeen = [];

        foreach ($parsedRows as $item) {
            $rowNumber = (int)($item['row_number'] ?? 0);
            $raw = is_array($item['raw_data'] ?? null) ? $item['raw_data'] : [];
            $data = is_array($item['data'] ?? null) ? $item['data'] : $raw;
            $issues = [];
            $firstName = null;
            $lastName = null;
            $massar = null;
            $birthDate = null;
            $studentNumber = null;

            try {
                $firstName = $studentService->validateName((string)($data['first_name'] ?? ''), 'first_name');
            } catch (InvalidArgumentException $e) {
                $issues[] = $e->getMessage();
            }

            try {
                $lastName = $studentService->validateName((string)($data['last_name'] ?? ''), 'last_name');
            } catch (InvalidArgumentException $e) {
                $issues[] = $e->getMessage();
            }

            try {
                $massar = $studentService->normalizeMassarCode(
                    isset($data['massar_code']) ? (string)$data['massar_code'] : null
                );
                if ($massar === null) {
                    $issues[] = 'Massar code is required.';
                }
            } catch (InvalidArgumentException $e) {
                $issues[] = $e->getMessage();
            }

            try {
                $birthDate = $studentService->validateBirthDate(
                    isset($data['birth_date']) ? (string)$data['birth_date'] : null
                );
                if ($birthDate === null) {
                    $issues[] = 'Birth date is required.';
                }
            } catch (InvalidArgumentException $e) {
                $issues[] = $e->getMessage();
            }

            try {
                $studentNumber = $studentService->normalizeNumber(
                    isset($data['student_number']) ? (string)$data['student_number'] : null
                );
            } catch (InvalidArgumentException $e) {
                $issues[] = $e->getMessage();
            }

            if ($massar !== null) {
                if (isset($massarSeen[$massar])) {
                    $issues[] = 'Duplicate Massar code in the import file.';
                }
                $massarSeen[$massar] = true;

                if (isset($existingMassarCodes[$massar])) {
                    $issues[] = 'Massar code already exists in SAMS.';
                }
            }

            if ($studentNumber !== null) {
                if (isset($numberSeen[$studentNumber])) {
                    $issues[] = 'Duplicate student number in the import file.';
                }
                $numberSeen[$studentNumber] = true;

                if (isset($existingNumbers[$studentNumber])) {
                    $issues[] = 'Student number already exists in the target class.';
                }
            }

            $status = $issues === [] ? 'valid' : 'error';

            $normalized[] = [
                'row_number' => $rowNumber,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'massar_code' => $massar,
                'birth_date' => $birthDate,
                'student_number' => $studentNumber,
                'status' => $status,
                'issues' => array_values(array_unique($issues)),
                'raw_data' => $raw,
            ];
        }

        return $normalized;
    }

    public function validateStagedRows(
        int $classId,
        array $rows,
        StudentRepository $students
    ): array {
        $massars = [];
        $numbers = [];

        foreach ($rows as $row) {
            $massar = trim((string)($row['massar_code'] ?? ''));
            $number = trim((string)($row['student_number'] ?? ''));

            if ($massar !== '') $massars[] = $massar;
            if ($number !== '') $numbers[] = $number;
        }

        return $this->validateRows(
            array_map(static function (array $row): array {
                return [
                    'row_number' => (int)$row['row_number'],
                    'raw_data' => is_array($row['raw_data'] ?? null) ? $row['raw_data'] : [],
                    'data' => [
                        'first_name' => (string)($row['first_name'] ?? ''),
                        'last_name' => (string)($row['last_name'] ?? ''),
                        'massar_code' => (string)($row['massar_code'] ?? ''),
                        'birth_date' => (string)($row['birth_date'] ?? ''),
                        'student_number' => $row['student_number'] ?? '',
                    ],
                ];
            }, $rows),
            $students->existingMassarCodes($massars),
            $students->existingNumbersInClass($classId, $numbers)
        );
    }

    public function assertImportable(array $batch): void
    {
        if ((string)($batch['status'] ?? '') !== 'validated') {
            throw new InvalidArgumentException('Import batch must be fully validated before import.');
        }

        $total = (int)($batch['total_rows'] ?? 0);
        $valid = (int)($batch['valid_rows'] ?? 0);
        $errors = (int)($batch['error_rows'] ?? 0);
        $warnings = (int)($batch['warning_rows'] ?? 0);

        if ($total < 1 || $valid !== $total || $errors !== 0 || $warnings !== 0) {
            throw new InvalidArgumentException('Import batch contains invalid rows.');
        }
    }

    public function summarize(array $rows): array
    {
        $total = count($rows);
        $errors = 0;
        $warnings = 0;

        foreach ($rows as $row) {
            $status = (string)($row['status'] ?? 'error');
            if ($status === 'error') ++$errors;
            elseif ($status === 'warning') ++$warnings;
        }

        return [
            'total_rows' => $total,
            'valid_rows' => $total - $errors - $warnings,
            'warning_rows' => $warnings,
            'error_rows' => $errors,
        ];
    }

    private function normalizeHeaders(array $headers): array
    {
        $normalized = [];

        foreach ($headers as $header) {
            $header = trim((string)$header);
            $header = strtolower($header);
            $header = preg_replace('/\s+/u', '_', $header) ?? $header;
            $header = preg_replace('/[^a-z0-9_]/', '', $header) ?? $header;

            if ($header === '') {
                $header = 'column_' . count($normalized);
            }

            if (in_array($header, $normalized, true)) {
                throw new InvalidArgumentException("Duplicate CSV column: {$header}.");
            }

            $normalized[] = $header;
        }

        return $normalized;
    }

    private function isBlankCsvRow(array $values): bool
    {
        foreach ($values as $value) {
            if (trim((string)$value) !== '') {
                return false;
            }
        }

        return true;
    }
}
