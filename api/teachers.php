<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Database;
use SAMS\Helpers\Response;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\ClassRepository;
use SAMS\Repositories\TeacherRepository;
use SAMS\Services\TeacherService;

try {
    $admin = Auth::requireRole('admin');
    $repo = new TeacherRepository();
    $service = new TeacherService();
    $method = sams_method();

    if ($method === 'GET') {
        Response::success([
            'teachers' => $repo->all(),
            'subjects' => $repo->subjects(),
            'teachings' => $repo->teachings(),
            'online_window_seconds' => TeacherRepository::ONLINE_WINDOW_SECONDS,
        ]);
    }

    if ($method !== 'POST') Response::error('Method not allowed.', 405);
    if (!Csrf::verify((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        Response::error('Invalid CSRF token.', 419);
    }

    $body = sams_json_body();
    $action = (string)($body['action'] ?? '');
    $pdo = Database::connection();
    $audit = new AuditLogRepository();

    if ($action === 'assign') {
        $teacherId = (int)($body['teacher_id'] ?? 0);
        $subjectId = (int)($body['subject_id'] ?? 0);
        $classId = (int)($body['class_id'] ?? 0);
        if ($teacherId < 1 || $subjectId < 1 || $classId < 1) {
            Response::error('Invalid teaching assignment.', 422);
        }
        if (!$repo->teacherExists($teacherId)) Response::error('Teacher not found.', 404);
        if (!$repo->subjectExists($subjectId)) Response::error('Subject not found.', 404);
        if (!$repo->classExistsActive($classId)) Response::error('Class not found or inactive.', 404);

        $pdo->beginTransaction();
        try {
            $id = $repo->assign($teacherId, $subjectId, $classId);
            $repo->ensureClassAccess($teacherId, $classId);
            $audit->record((int)$admin['id'], 'teacher_teaching.assign', 'teacher_teaching', $id, [
                'teacher_id' => $teacherId,
                'subject_id' => $subjectId,
                'class_id' => $classId,
            ]);
            $pdo->commit();
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                Response::error('This teaching assignment already exists.', 409);
            }
            throw $e;
        }
        Response::success(['id' => $id], 201);
    }

    if ($action === 'unassign') {
        $id = (int)($body['id'] ?? 0);
        if ($id < 1) Response::error('Invalid teaching assignment.', 422);

        $stmt = $pdo->prepare('SELECT teacher_id, subject_id, class_id FROM teacher_teachings WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) Response::error('Teaching assignment not found.', 404);

        $pdo->beginTransaction();
        try {
            $repo->unassign($id);
            $audit->record((int)$admin['id'], 'teacher_teaching.unassign', 'teacher_teaching', $id, [
                'teacher_id' => (int)$existing['teacher_id'],
                'subject_id' => (int)$existing['subject_id'],
                'class_id' => (int)$existing['class_id'],
            ]);
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
        Response::success(['changed' => true]);
    }

    if ($action === 'create_subject') {
        $code = $service->validateSubjectCode((string)($body['code'] ?? ''));
        $nameFr = $service->validateSubjectName((string)($body['name_fr'] ?? ''), 'French subject name');
        $nameAr = $service->validateSubjectName((string)($body['name_ar'] ?? ''), 'Arabic subject name');
        $nameEn = $service->validateSubjectName((string)($body['name_en'] ?? ''), 'English subject name');

        $pdo->beginTransaction();
        try {
            $id = $repo->createSubject($code, $nameFr, $nameAr, $nameEn);
            $audit->record((int)$admin['id'], 'subject.create', 'subject', $id, ['code' => $code]);
            $pdo->commit();
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ((int)($e->errorInfo[1] ?? 0) === 1062) Response::error('Subject code already exists.', 409);
            throw $e;
        }
        Response::success(['id' => $id], 201);
    }

    if ($action === 'update_subject') {
        $id = (int)($body['id'] ?? 0);
        if ($id < 1 || !$repo->subjectExists($id)) Response::error('Subject not found.', 404);
        $code = $service->validateSubjectCode((string)($body['code'] ?? ''));
        $nameFr = $service->validateSubjectName((string)($body['name_fr'] ?? ''), 'French subject name');
        $nameAr = $service->validateSubjectName((string)($body['name_ar'] ?? ''), 'Arabic subject name');
        $nameEn = $service->validateSubjectName((string)($body['name_en'] ?? ''), 'English subject name');
        $isActive = array_key_exists('is_active', $body) ? (bool)$body['is_active'] : true;

        $pdo->beginTransaction();
        try {
            $repo->updateSubject($id, $code, $nameFr, $nameAr, $nameEn, $isActive);
            $audit->record((int)$admin['id'], 'subject.update', 'subject', $id, ['code' => $code, 'is_active' => $isActive]);
            $pdo->commit();
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ((int)($e->errorInfo[1] ?? 0) === 1062) Response::error('Subject code already exists.', 409);
            throw $e;
        }
        Response::success(['id' => $id]);
    }

    Response::error('Unknown action.', 400);
} catch (InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[SAMS teachers] ' . $e->getMessage());
    Response::error('Server error.', 500);
}
