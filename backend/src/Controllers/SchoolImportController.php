<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Security;
use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Repositories\SchoolImportRepository;
use SAMS\Services\SchoolWorkbookImportService;
use SAMS\Services\SchoolWorkbookImportStagingService;
use SAMS\Services\SchoolWorkbookImportValidationService;

final class SchoolImportController
{
    public function __construct(
        private readonly SchoolWorkbookImportStagingService $staging = new SchoolWorkbookImportStagingService(
            new SchoolWorkbookImportService(),
            new SchoolWorkbookImportValidationService()
        )
    ) {}

    public function __invoke(Request $request, array $params = []): Response
    {
        Security::startSession(
            (string)($GLOBALS['appConfig']['session_name'] ?? 'SAMS_SESSION'),
            (int)($GLOBALS['appConfig']['session_lifetime'] ?? 3600)
        );

        $user = Auth::requireRole('admin');

        if ($request->method() === 'GET') {
            return $this->preview($request, $params);
        }

        if (!Csrf::verify($request->header('x-csrf-token'))) {
            return Response::json([
                'success' => false,
                'error' => 'Invalid CSRF token.',
            ], 419);
        }

        $file = $request->file('file');
        if ($file === null) {
            throw new \InvalidArgumentException('Excel workbook file is required.');
        }

        $uploadError = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($uploadError !== UPLOAD_ERR_OK) {
            throw new \InvalidArgumentException('Unable to receive the workbook.');
        }

        $tmpName = (string)($file['tmp_name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            throw new \InvalidArgumentException('Invalid uploaded workbook.');
        }

        $filename = basename((string)($file['name'] ?? ''));
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if (!in_array($extension, ['xlsx', 'xls'], true)) {
            throw new \InvalidArgumentException('Only XLSX and XLS workbooks are supported.');
        }

        $size = (int)($file['size'] ?? 0);
        if ($size < 1 || $size > SchoolWorkbookImportService::MAX_FILE_SIZE) {
            throw new \InvalidArgumentException('Workbook is empty or too large.');
        }

        $mime = null;
        if (class_exists(\finfo::class)) {
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->file($tmpName) ?: null;
        }
        $allowedMimes = [
            'xlsx' => [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/zip',
            ],
            'xls' => [
                'application/vnd.ms-excel',
                'application/octet-stream',
            ],
        ];
        if ($mime !== null && !in_array($mime, $allowedMimes[$extension], true)) {
            throw new \InvalidArgumentException('Workbook content type does not match its extension.');
        }

        $targetAcademicYearId = null;
        $rawTarget = $request->postValue('target_academic_year_id');
        if ($rawTarget !== null && trim((string)$rawTarget) !== '') {
            if (!ctype_digit((string)$rawTarget)) {
                throw new \InvalidArgumentException('Invalid target academic year.');
            }
            $targetAcademicYearId = (int)$rawTarget;
        }

        $result = $this->staging->stage(
            $tmpName,
            (int)$user['id'],
            $filename,
            $targetAcademicYearId
        );

        return Response::json([
            'success' => true,
            'data' => $result,
        ], 201);
    }
    private function preview(Request $request, array $params): Response
    {
        $batchId = isset($params['id']) && ctype_digit((string)$params['id'])
            ? (int)$params['id']
            : 0;

        if ($batchId < 1) {
            return Response::json([
                'success' => false,
                'error' => 'Invalid import batch.',
            ], 422);
        }

        $imports = new SchoolImportRepository();
        $batch = $imports->findBatch($batchId);
        if ($batch === null) {
            return Response::json([
                'success' => false,
                'error' => 'Import batch not found.',
            ], 404);
        }

        $classes = $imports->classesForBatch($batchId);
        $result = [
            'batch' => $batch,
            'classes' => $classes,
        ];

        $rawClassId = $request->queryValue('class_id');
        if ($rawClassId !== null && trim((string)$rawClassId) !== '') {
            if (!ctype_digit((string)$rawClassId) || (int)$rawClassId < 1) {
                return Response::json([
                    'success' => false,
                    'error' => 'Invalid import class.',
                ], 422);
            }

            $importClassId = (int)$rawClassId;
            $importClass = $imports->findClassInBatch($importClassId, $batchId);
            if ($importClass === null) {
                return Response::json([
                    'success' => false,
                    'error' => 'Import class not found.',
                ], 404);
            }

            $page = 1;
            $perPage = 50;
            $rawPage = $request->queryValue('page');
            $rawPerPage = $request->queryValue('per_page');
            if ($rawPage !== null && trim((string)$rawPage) !== '') {
                if (!ctype_digit((string)$rawPage)) {
                    return Response::json(['success' => false, 'error' => 'Invalid page.'], 422);
                }
                $page = max(1, (int)$rawPage);
            }
            if ($rawPerPage !== null && trim((string)$rawPerPage) !== '') {
                if (!ctype_digit((string)$rawPerPage)) {
                    return Response::json(['success' => false, 'error' => 'Invalid per_page.'], 422);
                }
                $perPage = min(100, max(1, (int)$rawPerPage));
            }

            $result['class'] = $importClass;
            $result['rows'] = $imports->rowsForClass($importClassId, $page, $perPage);
        }

        return Response::json([
            'success' => true,
            'data' => $result,
        ]);
    }

}
