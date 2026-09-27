<?php

declare(strict_types=1);

namespace SAMS\Services;

use SAMS\Exceptions\AdministrationException;
use SAMS\Helpers\Database;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\TeacherRepository;

final class TeacherAdministrationService
{
    public function __construct(
        private readonly TeacherRepository $repository = new TeacherRepository(),
        private readonly TeacherService $validator = new TeacherService(),
        private readonly AuditLogRepository $audit = new AuditLogRepository(),
    ) {}

    public function list(): array
    {
        return [
            'teachers' => $this->repository->all(),
            'subjects' => $this->repository->subjects(),
            'teachings' => $this->repository->teachings(),
            'online_window_seconds' => TeacherRepository::ONLINE_WINDOW_SECONDS,
        ];
    }

    public function assignTeaching(
        int $adminId,
        int $teacherId,
        int $subjectId,
        int $classId
    ): int {
        $this->assertAdminId($adminId);

        if ($teacherId < 1 || $subjectId < 1 || $classId < 1) {
            throw new \InvalidArgumentException('Invalid teaching assignment.');
        }

        if (!$this->repository->teacherExists($teacherId)) {
            throw new AdministrationException('Teacher not found.', 404);
        }
        if (!$this->repository->subjectExistsActive($subjectId)) {
            throw new AdministrationException('Subject not found or inactive.', 404);
        }
        if (!$this->repository->classExistsActive($classId)) {
            throw new AdministrationException('Class not found or inactive.', 404);
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $id = $this->repository->assign($teacherId, $subjectId, $classId);
            $this->repository->ensureClassAccess($teacherId, $classId);

            $this->audit->record(
                $adminId,
                'teacher_teaching.assign',
                'teacher_teaching',
                $id,
                [
                    'teacher_id' => $teacherId,
                    'subject_id' => $subjectId,
                    'class_id' => $classId,
                ]
            );

            $pdo->commit();

            return $id;
        } catch (\PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();

            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                throw new AdministrationException(
                    'This teaching assignment already exists.',
                    409
                );
            }

            throw $e;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public function unassignTeaching(int $adminId, int $teachingId): bool
    {
        $this->assertAdminId($adminId);
        if ($teachingId < 1) {
            throw new \InvalidArgumentException('Invalid teaching assignment.');
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $existing = $this->repository->findTeachingByIdForUpdate($teachingId);
            if ($existing === null) {
                throw new AdministrationException('Teaching assignment not found.', 404);
            }

            $this->repository->unassign($teachingId);

            $this->audit->record(
                $adminId,
                'teacher_teaching.unassign',
                'teacher_teaching',
                $teachingId,
                [
                    'teacher_id' => (int)$existing['teacher_id'],
                    'subject_id' => (int)$existing['subject_id'],
                    'class_id' => (int)$existing['class_id'],
                ]
            );

            $pdo->commit();

            return true;
        } catch (AdministrationException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public function createSubject(
        int $adminId,
        string $code,
        string $nameFr,
        string $nameAr,
        string $nameEn
    ): int {
        $this->assertAdminId($adminId);

        $code = $this->validator->validateSubjectCode($code);
        $nameFr = $this->validator->validateSubjectName($nameFr, 'French subject name');
        $nameAr = $this->validator->validateSubjectName($nameAr, 'Arabic subject name');
        $nameEn = $this->validator->validateSubjectName($nameEn, 'English subject name');

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $id = $this->repository->createSubject($code, $nameFr, $nameAr, $nameEn);
            $this->audit->record($adminId, 'subject.create', 'subject', $id, ['code' => $code]);
            $pdo->commit();

            return $id;
        } catch (\PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();

            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                throw new AdministrationException('Subject code already exists.', 409);
            }

            throw $e;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public function updateSubject(
        int $adminId,
        int $subjectId,
        string $code,
        string $nameFr,
        string $nameAr,
        string $nameEn,
        bool $isActive = true
    ): void {
        $this->assertAdminId($adminId);
        if ($subjectId < 1) {
            throw new \InvalidArgumentException('Invalid subject.');
        }

        if (!$this->repository->subjectExists($subjectId)) {
            throw new AdministrationException('Subject not found.', 404);
        }

        $code = $this->validator->validateSubjectCode($code);
        $nameFr = $this->validator->validateSubjectName($nameFr, 'French subject name');
        $nameAr = $this->validator->validateSubjectName($nameAr, 'Arabic subject name');
        $nameEn = $this->validator->validateSubjectName($nameEn, 'English subject name');

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $this->repository->updateSubject(
                $subjectId,
                $code,
                $nameFr,
                $nameAr,
                $nameEn,
                $isActive
            );

            $this->audit->record(
                $adminId,
                'subject.update',
                'subject',
                $subjectId,
                ['code' => $code, 'is_active' => $isActive]
            );

            $pdo->commit();
        } catch (\PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();

            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                throw new AdministrationException('Subject code already exists.', 409);
            }

            throw $e;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    private function assertAdminId(int $adminId): void
    {
        if ($adminId < 1) {
            throw new \InvalidArgumentException('Invalid administrator.');
        }
    }
}