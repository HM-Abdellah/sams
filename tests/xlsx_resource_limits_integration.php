<?php

declare(strict_types=1);

require_once __DIR__ . '/../backend/vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use SAMS\Services\SchoolWorkbookImportService;

function x_expect(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$path = tempnam(sys_get_temp_dir(), 'sams-xlsx-limit-');
x_expect($path !== false, 'Unable to create XLSX fixture path.');

$fixture = $path . '.xlsx';
@unlink($path);

try {
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('PathologicalRows');
    $sheet->setCellValue('A1', 'synthetic');

    // Intentionally create more worksheet rows than the early preflight cap.
    $sheet->getCell('A60001')->setValue('synthetic');
    $writer = new Xlsx($spreadsheet);
    $writer->save($fixture);
    $spreadsheet->disconnectWorksheets();
    unset($spreadsheet);

    $service = new SchoolWorkbookImportService();

    try {
        $service->parse($fixture, 'synthetic-pathological.xlsx');
        throw new RuntimeException('Pathological workbook was accepted.');
    } catch (InvalidArgumentException $e) {
        x_expect(
            str_contains($e->getMessage(), 'too many worksheet rows'),
            'Pathological workbook failed for an unexpected reason: ' . $e->getMessage()
        );
    }

    $size = filesize($fixture);
    x_expect($size !== false && $size < SchoolWorkbookImportService::MAX_FILE_SIZE,
        'The early-rejection fixture must stay below the normal file-size limit.');

    echo "XLSX resource-limit integration: PASS\n";
} finally {
    @unlink($fixture);
}