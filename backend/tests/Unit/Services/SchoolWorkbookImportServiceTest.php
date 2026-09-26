<?php

declare(strict_types=1);

namespace SAMS\Tests\Unit\Services;

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xls;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use SAMS\Services\SchoolWorkbookImportService;
use PHPUnit\Framework\TestCase;

final class SchoolWorkbookImportServiceTest extends TestCase
{
    public function testItParsesMultipleClassBlocksFromOneWorksheet(): void
    {
        $service = new SchoolWorkbookImportService();
        $path = $this->writeWorkbook(function (Spreadsheet $workbook): void {
            $sheet = $workbook->getActiveSheet();
            $sheet->setTitle('Roster');
            $rows = [
                ['المؤسسة', 'Lycée Test'],
                ['القسم', 'TCSF-1'],
                ['المستوى', 'Tronc Commun'],
                ['السنة الدراسية', '2025/2026'],
                ['', '', '', '', '', '', ''],
                ['ر.ت', 'الرمز', 'النسب', 'الإسم', 'النوع', 'تاريخ الازدياد', 'مكان الازدياد'],
                [1, 'AA123456', 'Nom1', 'Prenom1', 'ذكر', '2009-01-02', 'Rabat'],
                [2, 'AA123457', 'Nom2', 'Prenom2', 'أنثى', '03/04/2009', 'Temara'],
                ['', '', '', '', '', '', ''],
                ['القسم', 'TCSF-2'],
                ['المستوى', 'Tronc Commun'],
                ['السنة الدراسية', '2025/2026'],
                ['ر.ت', 'الرمز', 'النسب', 'الإسم', 'النوع', 'تاريخ الازدياد', 'مكان الازدياد'],
                [1, 'BB123456', 'Nom3', 'Prenom3', 'ذكر', '2009-05-06', 'Salé'],
            ];

            foreach ($rows as $rowNumber => $row) {
                $sheet->fromArray($row, null, 'A' . ($rowNumber + 1));
            }
        }, 'xlsx');

        try {
            $result = $service->parse($path);

            self::assertCount(2, $result['classes']);
            self::assertSame('TCSF-1', $result['classes'][0]['class_name']);
            self::assertSame('TCSF-2', $result['classes'][1]['class_name']);
            self::assertSame('2025/2026', $result['classes'][0]['academic_year']);
            self::assertCount(2, $result['classes'][0]['students']);
            self::assertSame('AA123456', $result['classes'][0]['students'][0]['massar_code']);
            self::assertSame('Prenom2', $result['classes'][0]['students'][1]['first_name']);
            self::assertSame('2009-04-03', $result['classes'][0]['students'][1]['birth_date']);
        } finally {
            @unlink($path);
        }
    }

    public function testHeaderDetectionDoesNotDependOnFixedColumnOrder(): void
    {
        $service = new SchoolWorkbookImportService();
        $path = $this->writeWorkbook(function (Spreadsheet $workbook): void {
            $sheet = $workbook->getActiveSheet();
            $sheet->fromArray([
                ['', 'المؤسسة', 'Lycée Test', '', '', '', ''],
                ['', 'القسم', 'TCSF-4', '', '', '', ''],
                ['', 'المستوى', 'Tronc Commun', '', '', '', ''],
                ['', 'السنة الدراسية', '2025/2026', '', '', '', ''],
                ['', '', '', '', '', '', ''],
                ['', 'الإسم', 'الرمز', 'تاريخ الازدياد', 'النوع', 'النسب', 'مكان الازدياد'],
                ['', 'Prenom10', 'HH123456', '2009-11-12', 'ذكر', 'Nom10', 'Rabat'],
                ['', '', '', '', '', '', ''],
                ['', 'Prenom11', 'HH123457', '13/12/2009', 'أنثى', 'Nom11', 'Temara'],
            ], null, 'A1');
        }, 'xlsx');

        try {
            $result = $service->parse($path);

            self::assertCount(1, $result['classes']);
            self::assertSame('TCSF-4', $result['classes'][0]['class_name']);
            self::assertCount(2, $result['classes'][0]['students']);
            self::assertSame('HH123457', $result['classes'][0]['students'][1]['massar_code']);
            self::assertSame('Nom11', $result['classes'][0]['students'][1]['last_name']);
            self::assertSame('2009-12-13', $result['classes'][0]['students'][1]['birth_date']);
        } finally {
            @unlink($path);
        }
    }

    public function testItCarriesMetadataFoundBeforeTheClassMarker(): void
    {
        $service = new SchoolWorkbookImportService();
        $path = $this->writeWorkbook(function (Spreadsheet $workbook): void {
            $sheet = $workbook->getActiveSheet();
            $sheet->fromArray([
                ['السنة الدراسية', '2025/2026'],
                ['المستوى', '1BAC'],
                ['القسم', '1BACSEF-3'],
                ['ر.ت', 'الرمز', 'النسب', 'الإسم', 'تاريخ الازدياد'],
                [1, 'FF123456', 'Nom8', 'Prenom8', '2008-01-02'],
            ], null, 'A1');
        }, 'xlsx');

        try {
            $result = $service->parse($path);

            self::assertSame('1BACSEF-3', $result['classes'][0]['class_name']);
            self::assertSame('1BAC', $result['classes'][0]['level']);
            self::assertSame('2025/2026', $result['classes'][0]['academic_year']);
        } finally {
            @unlink($path);
        }
    }

    public function testItParsesOneClassPerWorksheetAndPreservesSheetName(): void
    {
        $service = new SchoolWorkbookImportService();
        $path = $this->writeWorkbook(function (Spreadsheet $workbook): void {
            $first = $workbook->getActiveSheet();
            $first->setTitle('Classe 1');
            $first->fromArray([
                ['القسم', '1BACSEF-1'],
                ['السنة الدراسية', '2025/2026'],
                ['ر.ت', 'الرمز', 'النسب', 'الإسم', 'النوع', 'تاريخ الازدياد', 'مكان الازدياد'],
                [1, 'CC123456', 'Nom4', 'Prenom4', 'ذكر', '2008/06/07', 'Rabat'],
            ], null, 'A1');

            $second = $workbook->createSheet();
            $second->setTitle('Classe 2');
            $second->fromArray([
                ['القسم', '1BACSEF-2'],
                ['السنة الدراسية', '2025/2026'],
                ['ر.ت', 'الرمز', 'النسب', 'الإسم', 'النوع', 'تاريخ الازدياد', 'مكان الازدياد'],
                [1, 'DD123456', 'Nom5', 'Prenom5', 'أنثى', '2008/08/09', 'Temara'],
            ], null, 'A1');
        }, 'xlsx');

        try {
            $result = $service->parse($path);

            self::assertCount(2, $result['classes']);
            self::assertSame('Classe 1', $result['classes'][0]['source_sheet']);
            self::assertSame('1BACSEF-1', $result['classes'][0]['class_name']);
            self::assertSame('Classe 2', $result['classes'][1]['source_sheet']);
            self::assertSame('1BACSEF-2', $result['classes'][1]['class_name']);
        } finally {
            @unlink($path);
        }
    }

    public function testItReportsAHeaderFoundWithoutClassContext(): void
    {
        $service = new SchoolWorkbookImportService();
        $path = $this->writeWorkbook(function (Spreadsheet $workbook): void {
            $sheet = $workbook->getActiveSheet();
            $sheet->fromArray([
                ['ر.ت', 'الرمز', 'النسب', 'الإسم', 'تاريخ الازدياد'],
                [1, 'GG123456', 'Nom9', 'Prenom9', '2009-02-03'],
            ], null, 'A1');
        }, 'xlsx');

        try {
            $result = $service->parse($path);

            self::assertCount(0, $result['classes']);
            self::assertSame(['roster_without_class'], $result['sheets'][0]['issues']);
        } finally {
            @unlink($path);
        }
    }

    public function testItAcceptsXlsInput(): void
    {
        $service = new SchoolWorkbookImportService();
        $path = $this->writeWorkbook(function (Spreadsheet $workbook): void {
            $sheet = $workbook->getActiveSheet();
            $sheet->fromArray([
                ['القسم', 'TCLSHF-1'],
                ['السنة الدراسية', '2025/2026'],
                ['ر.ت', 'الرمز', 'النسب', 'الإسم', 'تاريخ الازدياد'],
                [1, 'EE123456', 'Nom6', 'Prenom6', '2009-10-11'],
            ], null, 'A1');
        }, 'xls');

        try {
            $result = $service->parse($path);

            self::assertCount(1, $result['classes']);
            self::assertSame('TCLSHF-1', $result['classes'][0]['class_name']);
        } finally {
            @unlink($path);
        }
    }

    public function testMalformedStudentRowProducesAnExplicitIssue(): void
    {
        $service = new SchoolWorkbookImportService();
        $path = $this->writeWorkbook(function (Spreadsheet $workbook): void {
            $sheet = $workbook->getActiveSheet();
            $sheet->fromArray([
                ['القسم', 'TCSF-3'],
                ['السنة الدراسية', '2025/2026'],
                ['ر.ت', 'الرمز', 'النسب', 'الإسم', 'تاريخ الازدياد'],
                [1, '', 'Nom7', 'Prenom7', '2009-01-01'],
            ], null, 'A1');
        }, 'xlsx');

        try {
            $result = $service->parse($path);

            self::assertCount(1, $result['classes']);
            self::assertCount(1, $result['classes'][0]['students']);
            self::assertContains('missing_massar_code', $result['classes'][0]['students'][0]['issues']);
        } finally {
            @unlink($path);
        }
    }

    public function testItReportsDuplicateMassarCodesAcrossTheWorkbook(): void
    {
        $service = new SchoolWorkbookImportService();
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
        }, 'xlsx');

        try {
            $parsed = $service->parse($path);
            $validator = new \SAMS\Services\SchoolWorkbookImportValidationService();
            $result = $validator->validate($parsed);

            self::assertFalse($result['valid']);
            self::assertGreaterThanOrEqual(2, $result['summary']['error_count']);
            self::assertContains('duplicate_massar_code_in_workbook', $result['classes'][0]['students'][0]['issues']);
            self::assertContains('duplicate_massar_code_in_workbook', $result['classes'][1]['students'][0]['issues']);
        } finally {
            @unlink($path);
        }
    }

    private function writeWorkbook(callable $builder, string $format): string
    {
        $spreadsheet = new Spreadsheet();
        $builder($spreadsheet);

        $path = tempnam(sys_get_temp_dir(), 'sams-school-import-');
        if ($path === false) {
            self::fail('Unable to create temporary workbook path.');
        }

        $filename = $path . '.' . $format;
        @unlink($path);

        if ($format === 'xls') {
            (new Xls($spreadsheet))->save($filename);
        } else {
            (new Xlsx($spreadsheet))->save($filename);
        }

        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        return $filename;
    }
}