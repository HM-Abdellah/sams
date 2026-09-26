<?php

declare(strict_types=1);

namespace SAMS\Services;

use DateTimeImmutable;
use InvalidArgumentException;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use Throwable;

final class SchoolWorkbookImportService
{
    public const MAX_FILE_SIZE = 20_000_000;
    public const MAX_SHEETS = 100;
    public const MAX_STUDENT_ROWS = 50_000;

    private const CLASS_LABELS = ['القسم'];
    private const LEVEL_LABELS = ['المستوى'];
    private const ACADEMIC_YEAR_LABELS = ['السنة الدراسية', 'السنة الدراسيّة'];

    private const HEADER_ALIASES = [
        'ordinal' => ['رت', 'ر ت'],
        'massar_code' => ['الرمز', 'رمز مسار', 'مسار'],
        'last_name' => ['النسب', 'الاسم العائلي', 'اللقب'],
        'first_name' => ['الاسم', 'الإسم'],
        'sex' => ['النوع', 'الجنس'],
        'birth_date' => ['تاريخ الازدياد', 'تاريخ الازدياد'],
        'birth_place' => ['مكان الازدياد'],
    ];

    /**
     * Parse a school workbook without writing to the database.
     *
     * @return array{classes: list<array<string,mixed>>, sheets: list<array<string,mixed>>, total_students: int}
     */
    public function parse(string $path, ?string $originalFilename = null): array
    {
        $this->assertReadableWorkbook($path, $originalFilename);

        if ($this->fileExtension($path, $originalFilename) === 'md') {
            return $this->parseMarkdown($path);
        }

        try {
            $reader = IOFactory::createReaderForFile($path);
            $reader->setReadDataOnly(true);
            $workbook = $reader->load($path);
        } catch (Throwable $e) {
            throw new InvalidArgumentException('Unable to read the Excel workbook.', 0, $e);
        }

        try {
            $sheetCount = $workbook->getSheetCount();
            if ($sheetCount > self::MAX_SHEETS) {
                throw new InvalidArgumentException('The workbook contains too many worksheets.');
            }

            $classes = [];
            $sheets = [];
            $totalStudents = 0;

            foreach ($workbook->getWorksheetIterator() as $sheet) {
                $sheetName = $sheet->getTitle();
                $rows = $sheet->toArray(null, true, true, true);
                $sheetResult = $this->parseSheet($sheetName, $rows);
                $sheetClasses = $sheetResult['classes'];

                $sheetStudentCount = 0;
                foreach ($sheetClasses as $class) {
                    $sheetStudentCount += count($class['students']);
                    $classes[] = $class;
                }

                $totalStudents += $sheetStudentCount;
                $sheets[] = [
                    'name' => $sheetName,
                    'class_count' => count($sheetClasses),
                    'student_count' => $sheetStudentCount,
                    'issues' => $sheetResult['issues'],
                ];
            }

            if ($totalStudents > self::MAX_STUDENT_ROWS) {
                throw new InvalidArgumentException('The workbook contains too many student rows.');
            }

            return [
                'classes' => $classes,
                'sheets' => $sheets,
                'total_students' => $totalStudents,
            ];
        } finally {
            $workbook->disconnectWorksheets();
            unset($workbook);
        }
    }

    private function assertReadableWorkbook(string $path, ?string $originalFilename = null): void
    {
        if ($path === '' || !is_file($path) || !is_readable($path)) {
            throw new InvalidArgumentException('The uploaded workbook is not readable.');
        }

        $size = filesize($path);
        if ($size === false || $size < 1) {
            throw new InvalidArgumentException('The workbook is empty.');
        }

        if ($size > self::MAX_FILE_SIZE) {
            throw new InvalidArgumentException('The workbook is too large.');
        }

        $extension = $this->fileExtension($path, $originalFilename);
        if (!in_array($extension, ['xlsx', 'xls', 'md'], true)) {
            throw new InvalidArgumentException('Only XLSX, XLS, and Markdown (.md) files are supported.');
        }
    }

    private function fileExtension(string $path, ?string $originalFilename = null): string
    {
        $source = $originalFilename !== null && trim($originalFilename) !== ''
            ? $originalFilename
            : $path;

        return strtolower(pathinfo($source, PATHINFO_EXTENSION));
    }

    private function parseMarkdown(string $path): array
    {
        $contents = file_get_contents($path);
        if ($contents === false) {
            throw new InvalidArgumentException('Unable to read the Markdown import file.');
        }

        $contents = preg_replace('/^\xEF\xBB\xBF/', '', $contents) ?? $contents;
        if (@preg_match('//u', $contents) !== 1) {
            throw new InvalidArgumentException('The Markdown import file must be valid UTF-8.');
        }

        $lines = preg_split('/\R/u', $contents);
        if (!is_array($lines)) {
            throw new InvalidArgumentException('Unable to parse the Markdown import file.');
        }

        $defaultSheetName = pathinfo($path, PATHINFO_FILENAME) ?: 'Markdown Import';
        $sheetGroups = [];
        $markdownSheetIssues = [];
        $currentSheetName = $defaultSheetName;
        $currentTable = [];
        $currentTableHasHeader = false;
        $currentTableHasMetadata = false;

        $flushTable = function () use (
            &$currentTable,
            &$currentTableHasHeader,
            &$currentTableHasMetadata,
            &$sheetGroups,
            &$markdownSheetIssues,
            &$currentSheetName
        ): void {
            if ($currentTable === []) return;

            $expectedColumnCount = null;
            foreach ($currentTable as $tableRow) {
                $cells = $tableRow['cells'];
                if ($this->isMarkdownSeparatorRow($cells)) continue;

                $columnCount = count($cells);
                if ($expectedColumnCount === null) {
                    $expectedColumnCount = $columnCount;
                } elseif ($columnCount !== $expectedColumnCount) {
                    $markdownSheetIssues[$currentSheetName][] = 'markdown_table_column_count_mismatch';
                }

                if ($this->detectHeader($cells) !== null) {
                    $currentTableHasHeader = true;
                }

                if ($this->hasMetadataLabel($cells)) {
                    $currentTableHasMetadata = true;
                }
            }

            if ($currentTableHasHeader || $currentTableHasMetadata) {
                foreach ($currentTable as $tableRow) {
                    $cells = $tableRow['cells'];
                    if ($this->isMarkdownSeparatorRow($cells)) continue;

                    if ($currentTableHasHeader || $this->hasMetadataLabel($cells)) {
                        $sheetGroups[$currentSheetName][$tableRow['line']] = $cells;
                    }
                }
            }

            $currentTable = [];
            $currentTableHasHeader = false;
            $currentTableHasMetadata = false;
        };

        foreach ($lines as $index => $line) {
            $lineNumber = $index + 1;
            $trimmed = trim((string)$line);

            if ($trimmed === '') {
                $flushTable();
                continue;
            }

            if (preg_match('/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/u', $trimmed, $matches) === 1) {
                $flushTable();
                $sheetName = trim($this->markdownInlineText($matches[1]));
                if ($sheetName !== '') {
                    $currentSheetName = $sheetName;
                }
                continue;
            }

            $cells = $this->markdownTableCells($trimmed);
            if ($cells !== null) {
                $currentTable[] = [
                    'line' => $lineNumber,
                    'cells' => $cells,
                ];
                continue;
            }

            $metadataRow = $this->markdownMetadataRow($trimmed);
            if ($metadataRow !== null) {
                $flushTable();
                $sheetGroups[$currentSheetName][$lineNumber] = $metadataRow;
                continue;
            }

            $flushTable();
        }

        $flushTable();

        $classes = [];
        $sheets = [];
        $totalStudents = 0;

        foreach ($sheetGroups as $sheetName => $rows) {
            if ($rows === []) continue;

            $lastLine = count($lines);
            if (!isset($rows[$lastLine])) {
                $rows[$lastLine] = [];
                ksort($rows);
            }

            $sheetResult = $this->parseSheet($sheetName, $rows);
            $sheetStudentCount = 0;

            foreach ($sheetResult['classes'] as $class) {
                $sheetStudentCount += count($class['students']);
                $classes[] = $class;
            }

            $totalStudents += $sheetStudentCount;
            $sheetIssues = array_values(array_unique(array_merge(
                $sheetResult['issues'],
                $markdownSheetIssues[$sheetName] ?? []
            )));
            $sheets[] = [
                'name' => $sheetName,
                'class_count' => count($sheetResult['classes']),
                'student_count' => $sheetStudentCount,
                'issues' => $sheetIssues,
            ];
        }

        if ($totalStudents > self::MAX_STUDENT_ROWS) {
            throw new InvalidArgumentException('The Markdown import contains too many student rows.');
        }

        if ($sheetGroups === []) {
            $sheets[] = [
                'name' => $defaultSheetName,
                'class_count' => 0,
                'student_count' => 0,
                'issues' => [],
            ];
        }

        return [
            'classes' => $classes,
            'sheets' => $sheets,
            'total_students' => $totalStudents,
        ];
    }

    /** @param array<int|string,mixed> $cells */
    private function hasMetadataLabel(array $cells): bool
    {
        foreach ([self::CLASS_LABELS, self::LEVEL_LABELS, self::ACADEMIC_YEAR_LABELS] as $labels) {
            foreach ($labels as $label) {
                $normalizedLabel = $this->normalizeText($label);
                foreach ($cells as $cell) {
                    if ($this->normalizeText($cell) === $normalizedLabel) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /** @return list<string>|null */
    private function markdownTableCells(string $line): ?array
    {
        if (!str_contains($line, '|')) return null;

        $work = trim($line);
        if (str_starts_with($work, '|')) $work = substr($work, 1);
        if (str_ends_with($work, '|') && !str_ends_with($work, '\\|')) {
            $work = substr($work, 0, -1);
        }

        $parts = preg_split('/(?<!\\\\)\|/u', $work);
        if (!is_array($parts) || count($parts) < 2) return null;

        return array_map(
            fn($cell): string => $this->markdownInlineText((string)$cell),
            $parts
        );
    }

    private function isMarkdownSeparatorRow(array $cells): bool
    {
        if ($cells === []) return false;

        foreach ($cells as $cell) {
            $value = trim($this->markdownInlineText((string)$cell));
            if ($value === '' || preg_match('/^:?-{3,}:?$/', $value) !== 1) {
                return false;
            }
        }

        return true;
    }

    /** @return list<string>|null */
    private function markdownMetadataRow(string $line): ?array
    {
        if (!preg_match('/^\s*(?:[-*]\s*)?(?:\*\*)?(.+?)(?:\*\*)?\s*[:：]\s*(.+?)\s*$/u', $line, $matches)) {
            return null;
        }

        $label = $this->markdownInlineText($matches[1]);
        $value = $this->markdownInlineText($matches[2]);

        foreach ([self::CLASS_LABELS, self::LEVEL_LABELS, self::ACADEMIC_YEAR_LABELS] as $labels) {
            foreach ($labels as $candidate) {
                if ($this->normalizeText($label) === $this->normalizeText($candidate)) {
                    return [$label, $value];
                }
            }
        }

        return null;
    }

    private function markdownInlineText(string $value): string
    {
        $value = str_replace(['\\|', '&vert;'], ['|', '|'], $value);
        $value = preg_replace('/<br\s*\/?>/iu', ' ', $value) ?? $value;
        $value = preg_replace('/(\x60\x60\x60|\x60|\*\*|__)/u', '', $value) ?? $value;
        return trim($value);
    }

    /** @return array{classes: list<array<string,mixed>>, issues: list<string>} */
    /** @param array<int|string,array<int|string,mixed>> $rows */
    private function parseSheet(string $sheetName, array $rows): array
    {
        $classes = [];
        $sheetIssues = [];
        $current = null;
        $header = null;
        $pendingMetadata = [
            'level' => null,
            'academic_year' => null,
        ];

        foreach ($rows as $rawRowNumber => $row) {
            $rowNumber = (int)$rawRowNumber;
            $row = is_array($row) ? $row : [];

            $className = $this->metadataValue($row, self::CLASS_LABELS);
            $level = $this->metadataValue($row, self::LEVEL_LABELS);
            $academicYear = $this->metadataValue($row, self::ACADEMIC_YEAR_LABELS);

            if ($className !== null) {
                if ($current !== null) {
                    $current['source_block_end_row'] = max(
                        (int)$current['source_block_start_row'],
                        $rowNumber - 1
                    );
                    $classes[] = $this->finalizeClass($current);
                }

                $current = [
                    'class_name' => $className,
                    'level' => $level ?? $pendingMetadata['level'],
                    'academic_year' => $academicYear ?? $pendingMetadata['academic_year'],
                    'source_sheet' => $sheetName,
                    'source_block_start_row' => $rowNumber,
                    'issues' => [],
                    'students' => [],
                ];
                $pendingMetadata = [
                    'level' => null,
                    'academic_year' => null,
                ];
                $header = null;

                if ($current['level'] === null) $current['issues'][] = 'missing_level';
                if ($current['academic_year'] === null) $current['issues'][] = 'missing_academic_year';

                continue;
            }

            if ($current !== null) {
                if ($level !== null && $current['level'] === null) {
                    $current['level'] = $level;
                    $current['issues'] = array_values(array_diff($current['issues'], ['missing_level']));
                }
                if ($academicYear !== null && $current['academic_year'] === null) {
                    $current['academic_year'] = $academicYear;
                    $current['issues'] = array_values(array_diff($current['issues'], ['missing_academic_year']));
                }
            } else {
                if ($level !== null) $pendingMetadata['level'] = $level;
                if ($academicYear !== null) $pendingMetadata['academic_year'] = $academicYear;
            }

            $detectedHeader = $this->detectHeader($row);
            if ($detectedHeader !== null) {
                $header = $detectedHeader;
                if ($current === null) {
                    $sheetIssues[] = 'roster_without_class';
                }
                continue;
            }

            if ($current === null || $header === null) continue;

            if (!$this->hasStudentSignal($row, $header)) continue;

            $student = $this->parseStudentRow($sheetName, $rowNumber, $row, $header);
            $current['students'][] = $student;

            if (count($current['students']) > self::MAX_STUDENT_ROWS) {
                throw new InvalidArgumentException('The workbook contains too many student rows.');
            }
        }

        if ($current !== null) {
            $current['source_block_end_row'] = $this->lastRowNumber($rows);
            $classes[] = $this->finalizeClass($current);
        }

        return [
            'classes' => $classes,
            'issues' => array_values(array_unique($sheetIssues)),
        ];
    }

    private function lastRowNumber(array $rows): int
    {
        if ($rows === []) return 0;

        $last = 0;
        foreach (array_keys($rows) as $key) {
            $last = max($last, (int)$key);
        }

        return $last;
    }

    private function finalizeClass(array $class): array
    {
        $class['issues'] = array_values(array_unique($class['issues']));
        $class['student_count'] = count($class['students']);

        if ($class['students'] === []) {
            $class['issues'][] = 'no_student_rows_detected';
        }

        return $class;
    }

    /** @param array<int|string,mixed> $row */
    private function metadataValue(array $row, array $labels): ?string
    {
        foreach ($row as $index => $value) {
            $text = $this->normalizeText($value);
            if ($text === '') continue;

            foreach ($labels as $label) {
                $normalizedLabel = $this->normalizeText($label);

                if ($text === $normalizedLabel) {
                    foreach ($row as $candidateIndex => $candidate) {
                        if ((string)$candidateIndex === (string)$index) continue;
                        $candidateText = trim((string)$candidate);
                        if ($candidateText !== '') return $candidateText;
                    }
                }

                $prefix = $normalizedLabel . ':';
                if (str_starts_with($text, $prefix)) {
                    $valueText = trim(substr($text, strlen($prefix)));
                    if ($valueText !== '') return $valueText;
                }

                $prefixWithSpace = $normalizedLabel . ' :';
                if (str_starts_with($text, $prefixWithSpace)) {
                    $valueText = trim(substr($text, strlen($prefixWithSpace)));
                    if ($valueText !== '') return $valueText;
                }
            }
        }

        return null;
    }

    /** @param array<int|string,mixed> $row */
    private function detectHeader(array $row): ?array
    {
        $header = [];

        foreach ($row as $column => $value) {
            $normalized = $this->normalizeText($value);
            if ($normalized === '') continue;

            foreach (self::HEADER_ALIASES as $field => $aliases) {
                foreach ($aliases as $alias) {
                    if ($normalized === $this->normalizeText($alias)) {
                        $header[$field] = $column;
                        break 2;
                    }
                }
            }
        }

        if (!isset($header['massar_code'], $header['first_name'], $header['last_name'])) {
            return null;
        }

        return $header;
    }

    private function hasStudentSignal(array $row, array $header): bool
    {
        foreach (['massar_code', 'first_name', 'last_name', 'ordinal'] as $field) {
            if (!array_key_exists($field, $header)) continue;
            $value = $row[$header[$field]] ?? null;
            if (trim((string)$value) !== '') return true;
        }

        return false;
    }

    private function parseStudentRow(string $sheetName, int $rowNumber, array $row, array $header): array
    {
        $issues = [];
        $massar = $this->cellText($row, $header['massar_code']);
        $lastName = $this->cellText($row, $header['last_name']);
        $firstName = $this->cellText($row, $header['first_name']);

        if ($massar === '') $issues[] = 'missing_massar_code';
        if ($lastName === '') $issues[] = 'missing_last_name';
        if ($firstName === '') $issues[] = 'missing_first_name';

        $birthDate = null;
        if (isset($header['birth_date'])) {
            $rawBirthDate = $row[$header['birth_date']] ?? null;
            $birthDate = $this->normalizeBirthDate($rawBirthDate);
            if ($this->cellText($row, $header['birth_date']) !== '' && $birthDate === null) {
                $issues[] = 'invalid_birth_date';
            }
        }

        return [
            'source_sheet' => $sheetName,
            'source_row' => $rowNumber,
            'roster_number' => isset($header['ordinal']) ? $this->cellText($row, $header['ordinal']) : null,
            'massar_code' => $massar !== '' ? $massar : null,
            'last_name' => $lastName !== '' ? $lastName : null,
            'first_name' => $firstName !== '' ? $firstName : null,
            'birth_date' => $birthDate,
            'sex' => isset($header['sex']) ? ($this->cellText($row, $header['sex']) ?: null) : null,
            'birth_place' => isset($header['birth_place']) ? ($this->cellText($row, $header['birth_place']) ?: null) : null,
            'issues' => array_values(array_unique($issues)),
        ];
    }

    private function normalizeBirthDate(mixed $value): ?string
    {
        if ($value === null || $value === '') return null;

        if (is_numeric($value)) {
            try {
                return ExcelDate::excelToDateTimeObject((float)$value)->format('Y-m-d');
            } catch (Throwable) {
                return null;
            }
        }

        $text = trim((string)$value);
        foreach (['Y-m-d', 'd/m/Y', 'd-m-Y', 'Y/m/d', 'd.m.Y'] as $format) {
            $date = DateTimeImmutable::createFromFormat('!' . $format, $text);
            $errors = DateTimeImmutable::getLastErrors();
            $hasErrors = is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0);
            if ($date !== false && !$hasErrors && $date->format($format) === $text) {
                return $date->format('Y-m-d');
            }
        }

        return null;
    }

    private function cellText(array $row, int|string $column): string
    {
        return trim((string)($row[$column] ?? ''));
    }

    private function normalizeText(mixed $value): string
    {
        $text = trim((string)$value);
        if ($text === '') return '';

        $text = preg_replace('/[\x{00A0}\x{202F}]+/u', ' ', $text) ?? $text;
        $text = preg_replace('/(\x60\x60\x60|\x60|\*\*|__)/u', '', $text) ?? $text;
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
        $text = str_replace(['：', '؛'], [':', ';'], $text);
        $text = preg_replace('/[.。]/u', '', $text) ?? $text;

        return trim($text);
    }
}