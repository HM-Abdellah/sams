<?php

declare(strict_types=1);

namespace SAMS\Services;

final class SchoolWorkbookImportValidationService
{
    /**
     * Validate parser output without touching the database.
     *
     * @param array<string,mixed> $parsed
     * @return array<string,mixed>
     */
    public function validate(array $parsed): array
    {
        $classes = is_array($parsed['classes'] ?? null) ? $parsed['classes'] : [];
        $sheets = is_array($parsed['sheets'] ?? null) ? $parsed['sheets'] : [];
        $workbookIssues = [];
        $seenMassars = [];
        $seenClasses = [];

        foreach ($sheets as $sheet) {
            $issues = is_array($sheet['issues'] ?? null) ? $sheet['issues'] : [];
            foreach ($issues as $issue) {
                $workbookIssues[] = [
                    'sheet' => (string)($sheet['name'] ?? ''),
                    'issue' => (string)$issue,
                ];
            }
        }

        foreach ($classes as $classIndex => &$class) {
            if (!is_array($class)) {
                $class = [
                    'class_name' => null,
                    'level' => null,
                    'academic_year' => null,
                    'source_sheet' => null,
                    'issues' => ['malformed_class_block'],
                    'students' => [],
                ];
            }

            $class['issues'] = $this->uniqueStrings($class['issues'] ?? []);
            $className = trim((string)($class['class_name'] ?? ''));
            $academicYear = trim((string)($class['academic_year'] ?? ''));

            if ($className === '') $class['issues'][] = 'missing_class_name';
            if ($academicYear === '') $class['issues'][] = 'missing_academic_year';

            $classKey = $this->canonicalKey($academicYear, $className);
            if ($classKey !== '|' && isset($seenClasses[$classKey])) {
                $class['issues'][] = 'duplicate_class_in_workbook';
                $firstClass = $seenClasses[$classKey];
                $classes[$firstClass]['issues'][] = 'duplicate_class_in_workbook';
            } elseif ($classKey !== '|') {
                $seenClasses[$classKey] = $classIndex;
            }

            $students = is_array($class['students'] ?? null) ? $class['students'] : [];
            foreach ($students as $studentIndex => &$student) {
                if (!is_array($student)) {
                    $student = ['issues' => ['malformed_student_row']];
                }

                $student['issues'] = $this->uniqueStrings($student['issues'] ?? []);
                $massar = trim((string)($student['massar_code'] ?? ''));

                if ($massar !== '') {
                    if (isset($seenMassars[$massar])) {
                        $student['issues'][] = 'duplicate_massar_code_in_workbook';
                        $first = $seenMassars[$massar];
                        $classes[$first['class_index']]['students'][$first['student_index']]['issues'][] = 'duplicate_massar_code_in_workbook';
                    } else {
                        $seenMassars[$massar] = [
                            'class_index' => $classIndex,
                            'student_index' => $studentIndex,
                        ];
                    }
                }
            }
            unset($student);

            $class['issues'] = $this->uniqueStrings($class['issues']);
            $class['student_count'] = count($students);
            $class['students'] = $students;
        }
        unset($class);

        $academicYears = [];
        foreach ($classes as $class) {
            $year = trim((string)($class['academic_year'] ?? ''));
            if ($year !== '') $academicYears[$year] = true;
        }
        if (count($academicYears) > 1) {
            $workbookIssues[] = [
                'sheet' => null,
                'issue' => 'multiple_academic_years',
            ];
        }

        $errorCount = count($this->errorIssues($workbookIssues));
        $warningCount = count($academicYears) > 1 ? 1 : 0;
        $studentCount = 0;

        foreach ($classes as &$class) {
            $class['issues'] = $this->uniqueStrings($class['issues'] ?? []);
            $students = is_array($class['students'] ?? null) ? $class['students'] : [];

            foreach ($students as &$student) {
                $student['issues'] = $this->uniqueStrings($student['issues'] ?? []);
                $student['status'] = $student['issues'] === [] ? 'valid' : 'error';
                if ($student['status'] === 'error') ++$errorCount;
            }
            unset($student);

            $class['students'] = $students;
            $class['student_count'] = count($students);
            $class['status'] = $class['issues'] === [] && !$this->hasStudentErrors($students) ? 'valid' : 'error';
            if ($class['status'] === 'error') ++$errorCount;
            $studentCount += count($students);
        }
        unset($class);

        return [
            'valid' => $errorCount === 0,
            'summary' => [
                'class_count' => count($classes),
                'student_count' => $studentCount,
                'error_count' => $errorCount,
                'warning_count' => $warningCount,
            ],
            'workbook_issues' => $this->uniqueIssueObjects($workbookIssues),
            'classes' => $classes,
        ];
    }

    private function hasStudentErrors(array $students): bool
    {
        foreach ($students as $student) {
            if (($student['status'] ?? 'error') === 'error') return true;
        }
        return false;
    }

    private function errorIssues(array $issues): array
    {
        return array_values(array_filter($issues, static fn(array $item): bool => !in_array($item['issue'], ['multiple_academic_years'], true)));
    }

    private function uniqueStrings(mixed $values): array
    {
        if (!is_array($values)) return [];
        $values = array_map(static fn($value): string => (string)$value, $values);
        return array_values(array_unique($values));
    }

    private function uniqueIssueObjects(array $issues): array
    {
        $result = [];
        $seen = [];
        foreach ($issues as $issue) {
            $key = (string)($issue['sheet'] ?? '') . '|' . (string)($issue['issue'] ?? '');
            if (isset($seen[$key])) continue;
            $seen[$key] = true;
            $result[] = $issue;
        }
        return $result;
    }

    private function canonicalKey(string $academicYear, string $className): string
    {
        return $this->normalize($academicYear) . '|' . $this->normalize($className);
    }

    private function normalize(string $value): string
    {
        return strtolower(trim(preg_replace('/\s+/u', ' ', $value) ?? $value));
    }
}