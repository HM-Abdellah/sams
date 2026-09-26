<?php

declare(strict_types=1);

namespace SAMS\Tests\Unit\Services;

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use SAMS\Services\SchoolWorkbookImportService;
use SAMS\Services\SchoolWorkbookImportValidationService;
use PHPUnit\Framework\TestCase;

final class SchoolWorkbookImportValidationServiceTest extends TestCase
{
    public function testItReportsDuplicateMassarCodesAcrossTheWorkbook(): void
    {
        $parser = new SchoolWorkbookImportService();
        $validator = new SchoolWorkbookImportValidationService();
        $path = $this->writeWorkbook(function (Spreadsheet $workbook): void {
            $sheet = $workbook->getActiveSheet();
            $sheet->fromArray([
                ['القسم', 'TCSF-5'],
                ['السنة الدراسية', '2025/2026'],
                ['ر.ت', 'الرمز', 'النسب', 'الإسم', 'تاريخ الازدياد'],
                [1, 'DUP123456', 'Nom12', 'Prenom12', '2009-01-01'],
                ['القسم', 'TCSF-6'],
                ['السنة الدراسية', '2025/2026'],
                ['ر.ت', 'الرمز', 'النسب', 'الإسم', 'تاريخ الازدياد'],
                [1, 'DUP123456', 'Nom13', 'Prenom13', '2009-02-02'],
            ], null, 'A1');
        });

        try {
            $result = $validator->validate($parser->parse($path));

            self::assertFalse($result['valid']);
            self::assertGreaterThanOrEqual(2, $result['summary']['error_count']);
            self::assertContains('duplicate_massar_code_in_workbook', $result['classes'][0]['students'][0]['issues']);
            self::assertContains('duplicate_massar_code_in_workbook', $result['classes'][1]['students'][0]['issues']);
            self::assertSame('error', $result['classes'][0]['students'][0]['status']);
            self::assertSame('error', $result['classes'][1]['students'][0]['status']);
        } finally {
            @unlink($path);
        }
    }

    public function testMixedAcademicYearsAreNotImportable(): void
    {
        $parser = new SchoolWorkbookImportService();
        $validator = new SchoolWorkbookImportValidationService();

        $path = $this->writeWorkbook(function (Spreadsheet $workbook): void {
            $sheet = $workbook->getActiveSheet();
            $sheet->fromArray([
                ['القسم', 'TCSF-7'],
                ['السنة الدراسية', '2025/2026'],
                ['ر.ت', 'الرمز', 'النسب', 'الإسم', 'تاريخ الازدياد'],
                [1, 'II123456', 'Nom14', 'Prenom14', '2009-01-01'],
                ['القسم', '2BACSE-1'],
                ['السنة الدراسية', '2026/2027'],
                ['ر.ت', 'الرمز', 'النسب', 'الإسم', 'تاريخ الازدياد'],
                [1, 'JJ123456', 'Nom15', 'Prenom15', '2008-01-01'],
            ], null, 'A1');
        });

        try {
            $result = $validator->validate($parser->parse($path));

            self::assertFalse($result['valid']);
            self::assertContains(
                'multiple_academic_years',
                array_column($result['workbook_issues'], 'issue')
            );
        } finally {
            @unlink($path);
        }
    }

    private function writeWorkbook(callable $builder): string
    {
        $spreadsheet = new Spreadsheet();
        $builder($spreadsheet);

        $path = tempnam(sys_get_temp_dir(), 'sams-school-validation-');
        if ($path === false) {
            self::fail('Unable to create temporary workbook path.');
        }

        $filename = $path . '.xlsx';
        @unlink($path);

        (new Xlsx($spreadsheet))->save($filename);
        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        return $filename;
    }
}
