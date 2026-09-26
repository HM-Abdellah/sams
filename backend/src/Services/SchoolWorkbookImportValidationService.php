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
        $errorCount = 0;
        $warningCount = 0;

        foreach ($sheets as $sheet) {
            $issues = is_array($sheet['issues'] ?? null) ? $sheet['issues'] : [];
            foreach ($issues as $issue) {
                $workbookIssues[] = [
                    'sheet' => (string)($sheet['name'] ?? ''),
                    'issue' => (string)$issue,
                ];
                ++$errorCount;
            }
        }

        foreach ($classes as $classIndex => &$class) {
            if (!is_array($class)) continue;
            $class['issues'] = array_values(array_unique(array_map('strval', is_array($class['issues'] ?? null) ? $class['issues'] : [])));

            $className = trim((string)($class['class_name'] ?? ''));
            $academicYear = trim((string)($class['academic_year'] ?? ''));

            if ($className === '') {
                $class['issues'][] = 'missing_class_name';
            }

            if ($academicYear === '') {
                $class['issues'][] = 'missing_academic_year';
            }

            $classKey = $this->canonicalKey($academicYear, $className);
            if ($classKey !== '|' && isset($seenClasses[$classKey])) {
                $class['issues'][] = 'duplicate_class_in_workbook';
                $classes[$seenClasses[$classKey]]['issues'][] = 'duplicate_class_in_workbook';
            } elseif ($classKey !== '|') {
                $seenClasses[$classKey] = $classIndex;
            }

            $students = is_array($class['students'] ?? null) ? $class['students'] : [];
            foreach ($students as $studentIndex => &$student) {
                if (!is_array($student)) continue;
                $student['issues'] = array_values(array_unique(array_map('strval', is_array($student['issues'] ?? null) ? $student['issues'] : [])));

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

                $student['issues'] = array_values(array_unique($student['issues']));
                $student['status'] = $student['issues'] === [] ? 'valid' : 'error';
                if ($student['status'] === 'error') ++$errorCount;
            }
            unset($student);

            if ($class['issues'] !== []) {
                $class['status'] = 'error';
                $errorCount += count(array_unique($class['issues']));
            } else {
                $class['status'] = 'valid';
            }

            $class['issues'] = array_values(array_unique($class['issues']));
        }
        unset($class);

        $classCount = count($classes);
        $studentCount = 0;
        foreach ($classes as $class) {
            $studentCount += is_array($class['students'] ?? null) ? count($class['students']) : 0;
        }

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
            ++$warningCount;
        }

        return [
            'valid' => $errorCount === 0,
            'summary' => [
                'class_count' => $classCount,
                'student_count' => $studentCount,
                'error_count' => $errorCount,
                'warning_count' => $warningCount,
            ],
            'workbook_issues' => $workbookIssues,
            'classes' => $classes,
        ];
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