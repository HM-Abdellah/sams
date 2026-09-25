<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Database;
use SAMS\Helpers\Response;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\ClassRepository;
use SAMS\Repositories\StudentImportRepository;
use SAMS\Repositories\StudentRepository;
use SAMS\Services\StudentImportService;
use SAMS\Services\StudentService;

try {
    $user = Auth::requireLogin();
    $role = (string)$user['role'];

    if (!in_array($role, ['admin', 'teacher'], true)) {
        Response::error('Forbidden.', 403);
    }

    $imports = new StudentImportRepository();
    $students = new StudentRepository();
    $classes = new ClassRepository();
    $service = new StudentImportService();
    $method = sams_method();

    if ($method === 'GET') {
        $batchId = (int)($_GET['batch_id'] ?? 0);
        $classId = (int)($_GET['class_id'] ?? 0);

        if ($batchId > 0) {
            $batch = $imports->findBatch($batchId);
            if ($batch === null) Response::error('Import batch not found.', 404);

            $classId = (int)$batch['class_id'];
            if (!$classes->hasAccess((int)$user['id'], $role, $classId)) {
                Response::error('Forbidden.', 403);
            }

            Response::success([
                'batch' => $batch,
                'rows' => $imports->forBatch($batchId),
            ]);
        }

        if ($classId < 1) {
            Response::error('Provide class_id or batch_id.', 422);
        }

        if (!$classes->hasAccess((int)$user['id'], $role, $classId)) {
            Response::error('Forbidden.', 403);
        }

        Response::success([
            'imports' => $imports->forClass($classId),
        ]);
    }

    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }

    $audit = new AuditLogRepository();

    if ($method === 'POST') {
        $body = [];
        if (isset($_FILES['file'])) {
            $action = (string)($_POST['action'] ?? 'stage');
        } else {
            $body = sams_json_body();
            $action = (string)($body['action'] ?? '');
        }

        if ($action === 'stage') {
            $classId = (int)($_POST['class_id'] ?? 0);
            if ($classId < 1) Response::error('Invalid class.', 422);

            if (!$classes->hasAccess((int)$user['id'], $role, $classId)) {
                Response::error('Forbidden.', 403);
            }

            $file = $_FILES['file'] ?? null;
            if (!is_array($file)) Response::error('CSV file is required.', 422);

            $uploadError = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
            if ($uploadError !== UPLOAD_ERR_OK) {
                Response::error('Unable to receive the CSV file.', 422);
            }

            $filename = trim((string)($file['name'] ?? 'students.csv'));
            if ($filename === '' || mb_strlen($filename) > 255) {
                Response::error('Invalid filename.', 422);
            }

            $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
            if ($extension !== 'csv') {
                Response::error('Only CSV files are supported.', 422);
            }

            $size = (int)($file['size'] ?? 0);
            if ($size < 1 || $size > StudentImportService::MAX_FILE_SIZE) {
                Response::error('CSV file is empty or too large.', 422);
            }

            $tmpName = (string)($file['tmp_name'] ?? '');
            if ($tmpName === '' || !is_uploaded_file($tmpName)) {
                Response::error('Invalid uploaded file.', 422);
            }

            $content = file_get_contents($tmpName);
            if (!is_string($content)) {
                Response::error('Unable to read the uploaded CSV file.', 422);
            }

            $parsed = $service->parseCsv($content);

            $massars = [];
            $numbers = [];
            foreach ($parsed as $row) {
                $data = $row['data'];
                $massar = trim((string)($data['massar_code'] ?? ''));
                $number = trim((string)($data['student_number'] ?? ''));
                if ($massar !== '') $massars[] = $massar;
                if ($number !== '') $numbers[] = $number;
            }

            $validatedRows = $service->validateRows(
                $parsed,
                $students->existingMassarCodes($massars),
                $students->existingNumbersInClass($classId, $numbers)
            );
            $summary = $service->summarize($validatedRows);
            $status = $summary['error_rows'] === 0 && $summary['warning_rows'] === 0
                ? 'validated'
                : 'staged';

            $pdo = Database::connection();
            $pdo->beginTransaction();

            try {
                $batchId = $imports->createBatch(
                    $classId,
                    (int)$user['id'],
                    $filename,
                    hash('sha256', $content),
                    $size,
                    $summary['total_rows'],
                    $summary['valid_rows'],
                    $summary['warning_rows'],
                    $summary['error_rows'],
                    $status
                );

                foreach ($validatedRows as $row) {
                    $imports->createRow(
                        $batchId,
                        (int)$row['row_number'],
                        $row['first_name'],
                        $row['last_name'],
                        $row['massar_code'],
                        $row['birth_date'],
                        $row['student_number'],
                        $row['status'],
                        $row['issues'],
                        $row['raw_data']
                    );
                }

                $audit->record(
                    (int)$user['id'],
                    'student_import.stage',
                    'student_import_batch',
                    $batchId,
                    [
                        'class_id' => $classId,
                        'filename' => $filename,
                        'total_rows' => $summary['total_rows'],
                        'valid_rows' => $summary['valid_rows'],
                        'error_rows' => $summary['error_rows'],
                    ]
                );

                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();

                if ($e instanceof PDOException && (int)($e->errorInfo[1] ?? 0) === 1062) {
                    Response::error('This CSV file has already been staged for this class.', 409);
                }

                throw $e;
            }

            Response::success([
                'batch_id' => $batchId,
                'summary' => $summary,
            ], 201);
        }

        $batchId = (int)($body['batch_id'] ?? 0);
        if ($batchId < 1) Response::error('Invalid import batch.', 422);

        $batch = $imports->findBatch($batchId);
        if ($batch === null) Response::error('Import batch not found.', 404);

        $classId = (int)$batch['class_id'];
        if (!$classes->hasAccess((int)$user['id'], $role, $classId)) {
            Response::error('Forbidden.', 403);
        }

        if (in_array((string)$batch['status'], ['imported', 'failed'], true)) {
            if (in_array($action, ['correct', 'revalidate', 'import'], true)) {
                Response::error('This import batch can no longer be modified.', 409);
            }
        }

        if ($action === 'correct') {
            $rowId = (int)($body['row_id'] ?? 0);
            if ($rowId < 1) Response::error('Invalid import row.', 422);

            $rows = $imports->forBatch($batchId);
            $target = null;
            foreach ($rows as $row) {
                if ((int)$row['id'] === $rowId) {
                    $target = $row;
                    break;
                }
            }

            if ($target === null) Response::error('Import row not found.', 404);

            $studentService = new StudentService();
            $firstName = $studentService->validateName((string)($body['first_name'] ?? ''), 'first_name');
            $lastName = $studentService->validateName((string)($body['last_name'] ?? ''), 'last_name');

            $massarCode = $studentService->normalizeMassarCode(
                isset($body['massar_code']) ? (string)$body['massar_code'] : null
            );
            if ($massarCode === null) Response::error('Massar code is required.', 422);

            $birthDate = $studentService->validateBirthDate(
                isset($body['birth_date']) ? (string)$body['birth_date'] : null
            );
            if ($birthDate === null) Response::error('Birth date is required.', 422);

            $studentNumber = $studentService->normalizeNumber(
                isset($body['student_number']) ? (string)$body['student_number'] : null
            );

            $rawData = is_array($target['raw_data'] ?? null) ? $target['raw_data'] : [];
            $rawData['first_name'] = $firstName;
            $rawData['last_name'] = $lastName;
            $rawData['massar_code'] = $massarCode;
            $rawData['birth_date'] = $birthDate;
            $rawData['student_number'] = $studentNumber ?? '';

            $pdo = Database::connection();
            $pdo->beginTransaction();

            try {
                $changed = $imports->updateRow(
                    $batchId,
                    $rowId,
                    $firstName,
                    $lastName,
                    $massarCode,
                    $birthDate,
                    $studentNumber,
                    'valid',
                    [],
                    $rawData
                );

                if (!$changed) Response::error('Import row not found.', 404);

                $imports->updateStats(
                    $batchId,
                    (int)$batch['total_rows'],
                    (int)$batch['valid_rows'],
                    (int)$batch['warning_rows'],
                    (int)$batch['error_rows'],
                    'staged'
                );

                $audit->record(
                    (int)$user['id'],
                    'student_import.correct',
                    'student_import_batch',
                    $batchId,
                    ['row_id' => $rowId]
                );

                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $e;
            }

            Response::success(['changed' => true, 'status' => 'staged']);
        }

        if ($action === 'revalidate') {
            $pdo = Database::connection();
            $pdo->beginTransaction();

            try {
                $lockedBatch = $imports->findBatchForUpdate($batchId);
                if ($lockedBatch === null) Response::error('Import batch not found.', 404);

                $rows = $imports->forBatch($batchId);
                $validatedRows = $service->validateStagedRows($classId, $rows, $students);
                $summary = $service->summarize($validatedRows);
                $status = $summary['error_rows'] === 0 && $summary['warning_rows'] === 0
                    ? 'validated'
                    : 'staged';

                foreach ($validatedRows as $index => $row) {
                    $existing = $rows[$index] ?? null;
                    if ($existing === null) continue;

                    $imports->updateRow(
                        $batchId,
                        (int)$existing['id'],
                        $row['first_name'],
                        $row['last_name'],
                        $row['massar_code'],
                        $row['birth_date'],
                        $row['student_number'],
                        $row['status'],
                        $row['issues'],
                        $row['raw_data']
                    );
                }

                $imports->updateStats(
                    $batchId,
                    $summary['total_rows'],
                    $summary['valid_rows'],
                    $summary['warning_rows'],
                    $summary['error_rows'],
                    $status
                );

                $audit->record(
                    (int)$user['id'],
                    'student_import.revalidate',
                    'student_import_batch',
                    $batchId,
                    $summary
                );

                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $e;
            }

            Response::success(['batch_id' => $batchId, 'summary' => $summary, 'status' => $status]);
        }

        if ($action === 'import') {
            $pdo = Database::connection();
            $pdo->beginTransaction();

            try {
                $lockedBatch = $imports->findBatchForUpdate($batchId);
                if ($lockedBatch === null) Response::error('Import batch not found.', 404);

                $service->assertImportable($lockedBatch);

                $rows = $imports->forBatch($batchId);
                $validatedRows = $service->validateStagedRows($classId, $rows, $students);
                $summary = $service->summarize($validatedRows);

                if ($summary['error_rows'] !== 0 || $summary['warning_rows'] !== 0) {
                    foreach ($validatedRows as $index => $row) {
                        $existing = $rows[$index] ?? null;
                        if ($existing === null) continue;

                        $imports->updateRow(
                            $batchId,
                            (int)$existing['id'],
                            $row['first_name'],
                            $row['last_name'],
                            $row['massar_code'],
                            $row['birth_date'],
                            $row['student_number'],
                            $row['status'],
                            $row['issues'],
                            $row['raw_data']
                        );
                    }

                    $imports->updateStats(
                        $batchId,
                        $summary['total_rows'],
                        $summary['valid_rows'],
                        $summary['warning_rows'],
                        $summary['error_rows'],
                        'staged'
                    );

                    $pdo->commit();
                    Response::error('Import validation is no longer clean. Revalidate the batch.', 409, $summary);
                }

                $createdStudentIds = [];
                foreach ($validatedRows as $index => $row) {
                    $studentId = $students->create(
                        $classId,
                        $row['student_number'],
                        $row['massar_code'],
                        $row['birth_date'],
                        $row['first_name'],
                        $row['last_name']
                    );

                    $createdStudentIds[] = $studentId;

                    $targetRow = $rows[$index] ?? null;
                    if ($targetRow === null) {
                        throw new RuntimeException('Import row alignment error.');
                    }

                    $imports->markRowImported(
                        $batchId,
                        (int)$targetRow['id'],
                        $studentId
                    );

                    $audit->record(
                        (int)$user['id'],
                        'student.create',
                        'student',
                        $studentId,
                        ['class_id' => $classId, 'source' => 'student_import', 'batch_id' => $batchId]
                    );
                }

                $imports->updateStats(
                    $batchId,
                    $summary['total_rows'],
                    $summary['total_rows'],
                    0,
                    0,
                    'imported'
                );

                $audit->record(
                    (int)$user['id'],
                    'student_import.import',
                    'student_import_batch',
                    $batchId,
                    [
                        'class_id' => $classId,
                        'created_students' => count($createdStudentIds),
                    ]
                );

                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();

                if ($e instanceof PDOException && (int)($e->errorInfo[1] ?? 0) === 1062) {
                    Response::error('Import conflicts with existing student identifiers.', 409);
                }

                throw $e;
            }

            Response::success([
                'batch_id' => $batchId,
                'imported_rows' => $summary['total_rows'],
            ]);
        }

        Response::error('Unknown import action.', 400);
    }

    Response::error('Method not allowed.', 405);
} catch (InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[SAMS imports] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
