<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Database;
use SAMS\Helpers\Response;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\ClassRepository;
use SAMS\Repositories\StudentRepository;
use SAMS\Services\StudentService;

try {
    $user = Auth::requireLogin();
    $classId = (int)($_GET['class_id'] ?? 0);

    if ($classId < 1) Response::error('Invalid class.', 422);

    if (!(new ClassRepository())->hasAccess(
        (int)$user['id'],
        (string)$user['role'],
        $classId
    )) {
        Response::error('Forbidden.', 403);
    }

    $repo = new StudentRepository();
    $method = sams_method();

    if ($method === 'GET') {
        Response::success(['students' => $repo->forClass($classId)]);
    }

    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }

    $body = sams_json_body();
    $action = (string)($body['action'] ?? '');
    $audit = new AuditLogRepository();

    if ($action === 'transfer') {
        Auth::requireRole('admin');

        $studentId = (int)($body['id'] ?? 0);
        $targetClassId = (int)($body['target_class_id'] ?? 0);
        $effectiveDate = trim((string)($body['effective_date'] ?? ''));

        if ($studentId < 1 || $targetClassId < 1) {
            Response::error('Invalid transfer parameters.', 422);
        }

        $parsedDate = DateTimeImmutable::createFromFormat('!Y-m-d', $effectiveDate);
        if (!$parsedDate || $parsedDate->format('Y-m-d') !== $effectiveDate) {
            Response::error('Invalid transfer effective date.', 422);
        }

        $student = $repo->findInClass($studentId, $classId);
        if ($student === null || (string)$student['status'] !== 'active') {
            Response::error('Student not found.', 404);
        }

        if ($targetClassId === $classId) {
            Response::error('Target class must be different from the current class.', 409);
        }

        $targetClass = $classes->find($targetClassId);
        if ($targetClass === null) {
            Response::error('Target class not found.', 404);
        }

        $sourceClass = $classes->find($classId);
        if ($sourceClass === null) {
            Response::error('Current class not found.', 404);
        }

        if (!(bool)$targetClass['is_active']) {
            Response::error('Target class is not active.', 409);
        }

        if ((int)$targetClass['academic_year_id'] !== (int)$sourceClass['academic_year_id']) {
            Response::error('Transfers must stay within the same academic year.', 409);
        }

        if (
            $effectiveDate < (string)$sourceClass['academic_year_starts_on']
            || $effectiveDate > (string)$sourceClass['academic_year_ends_on']
        ) {
            Response::error('Transfer date is outside the current academic year.', 422);
        }

        $enrollments = new SAMSRepositoriesStudentEnrollmentRepository();
        $currentEnrollment = $enrollments->currentForStudent($studentId);
        if ($currentEnrollment === null || (int)$currentEnrollment['class_id'] !== $classId) {
            Response::error('Current student enrollment could not be resolved.', 409);
        }

        if ($effectiveDate <= (string)$currentEnrollment['starts_on']) {
            Response::error('Transfer date must be after the current enrollment start date.', 422);
        }

        if ($enrollments->hasAttendanceOnOrAfter((int)$currentEnrollment['id'], $effectiveDate)) {
            Response::error('Attendance already exists on or after the transfer date.', 409);
        }

        $existingTargetNumber = (string)($student['student_number'] ?? '');
        if ($existingTargetNumber !== '') {
            $targetNumbers = $repo->existingNumbersInClass($targetClassId, [$existingTargetNumber]);
            if (isset($targetNumbers[$existingTargetNumber])) {
                Response::error('Student number is already used in the target class.', 409);
            }
        }

        $endsOn = $parsedDate->modify('-1 day')->format('Y-m-d');
        $pdo = Database::connection();
        $audit = new AuditLogRepository();

        $pdo->beginTransaction();
        try {
            $enrollments->close((int)$currentEnrollment['id'], $endsOn);
            $newEnrollmentId = $enrollments->create($studentId, $targetClassId, $effectiveDate);
            $repo->transfer($studentId, $classId, $targetClassId);

            $audit->record(
                (int)$user['id'],
                'student.transfer',
                'student',
                $studentId,
                [
                    'from_class_id' => $classId,
                    'to_class_id' => $targetClassId,
                    'effective_date' => $effectiveDate,
                    'previous_enrollment_id' => (int)$currentEnrollment['id'],
                    'new_enrollment_id' => $newEnrollmentId,
                ]
            );

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();

            if ($e instanceof PDOException && (int)($e->errorInfo[1] ?? 0) === 1062) {
                Response::error('Student already has an enrollment starting on this date.', 409);
            }

            throw $e;
        }

        Response::success([
            'id' => $studentId,
            'class_id' => $targetClassId,
            'enrollment_id' => $newEnrollmentId,
            'effective_date' => $effectiveDate,
        ]);
    }

    if ($action === 'create' || $action === 'update') {
        Auth::requireRole('admin', 'teacher');

        $service = new StudentService();
        $first = $service->validateName((string)($body['first_name'] ?? ''), 'first_name');
        $last = $service->validateName((string)($body['last_name'] ?? ''), 'last_name');
        $number = $service->normalizeNumber(
            isset($body['student_number']) ? (string)$body['student_number'] : null
        );
        $massarCode = $service->normalizeMassarCode(
            isset($body['massar_code']) ? (string)$body['massar_code'] : null
        );
        $birthDate = $service->validateBirthDate(
            isset($body['birth_date']) ? (string)$body['birth_date'] : null
        );

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            if ($action === 'create') {
                $id = $repo->create(
                    $classId,
                    $number,
                    $massarCode,
                    $birthDate,
                    $first,
                    $last
                );

                $audit->record(
                    (int)$user['id'],
                    'student.create',
                    'student',
                    $id,
                    ['class_id' => $classId]
                );

                $pdo->commit();
                Response::success(['id' => $id], 201);
            }

            $studentId = (int)($body['id'] ?? 0);
            if ($studentId < 1) Response::error('Invalid student.', 422);

            $existing = $repo->findInClass($studentId, $classId);
            if ($existing === null) Response::error('Student not found.', 404);

            $repo->update(
                $studentId,
                $classId,
                $number,
                $massarCode,
                $birthDate,
                $first,
                $last
            );

            $audit->record(
                (int)$user['id'],
                'student.update',
                'student',
                $studentId,
                ['class_id' => $classId]
            );

            $pdo->commit();
            Response::success(['id' => $studentId]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();

            if ($e instanceof PDOException && (int)($e->errorInfo[1] ?? 0) === 1062) {
                Response::error('A student identifier is already in use.', 409);
            }

            throw $e;
        }
    }

    if ($action === 'delete') {
        $user = Auth::requireRole('admin');
        $studentId = (int)($body['id'] ?? 0);

        if ($studentId < 1) Response::error('Invalid student.', 422);

        $student = $repo->findInClass($studentId, $classId);
        if ($student === null) Response::error('Student not found.', 404);

        if ((string)$student['status'] === 'inactive') {
            Response::success(['changed' => false]);
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $repo->deactivate($studentId, $classId);
            $audit->record(
                (int)$user['id'],
                'student.deactivate',
                'student',
                $studentId,
                ['class_id' => $classId]
            );
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        Response::success(['changed' => true]);
    }

    Response::error('Unknown action.', 400);
} catch (InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[SAMS students] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
