<?php

declare(strict_types=1);

namespace SAMS\Services;

use SAMS\Exceptions\AdministrationException;
use SAMS\Helpers\Database;
use SAMS\Repositories\ClassRepository;
use SAMS\Repositories\TeacherClassRepository;
use SAMS\Repositories\UserRepository;
use SAMS\Repositories\AuditLogRepository;

final class TeacherClassAdministrationService
{
    public function __construct(
        private readonly TeacherClassRepository $repository = new TeacherClassRepository(),
        private readonly UserRepository $users = new UserRepository(),
        private readonly ClassRepository $classes = new ClassRepository(),
        private readonly AuditLogRepository $audit = new AuditLogRepository(),
    ) {}

    public function forClass(int $classId): array
    {
        if ($classId < 1) throw new \InvalidArgumentException('Invalid class.');
        return $this->repository->forClass($classId);
    }

    public function forTeacher(int $teacherId): array
    {
        if ($teacherId < 1) throw new \InvalidArgumentException('Invalid teacher.');
        return $this->repository->forTeacher($teacherId);
    }

    public function assign(int $adminId, int $teacherId, int $classId): bool
    {
        $this->assertAdminId($adminId);

        if ($teacherId < 1 || $classId < 1) {
            throw new \InvalidArgumentException('Invalid teacher or class.');
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $teacher = $this->users->findByIdForUpdate($teacherId);
            $class = $this->classes->findForUpdate($classId);

            if (
                $teacher === null
                || (string)$teacher['role'] !== 'teacher'
                || !(bool)$teacher['is_active']
            ) {
                throw new AdministrationException('Teacher not found or inactive.', 404);
            }

            if ($class === null || !(bool)$class['is_active']) {
                throw new AdministrationException('Class not found or inactive.', 404);
            }

            if ($this->repository->exists($teacherId, $classId)) {
                $pdo->rollBack();
                return false;
            }

            $this->repository->assign($teacherId, $classId);
            $this->audit->record(
                $adminId,
                'teacher_class.assign',
                'class',
                $classId,
                ['teacher_id' => $teacherId]
            );

            $pdo->commit();
            return true;
        } catch (\PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ((int)($e->errorInfo[1] ?? 0) === 1062) return false;
            throw $e;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public function unassign(int $adminId, int $teacherId, int $classId): bool
    {
        $this->assertAdminId($adminId);

        if ($teacherId < 1 || $classId < 1) {
            throw new \InvalidArgumentException('Invalid teacher or class.');
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            if (!$this->repository->exists($teacherId, $classId)) {
                $pdo->rollBack();
                return false;
            }

            $this->repository->unassign($teacherId, $classId);
            $this->audit->record(
                $adminId,
                'teacher_class.unassign',
                'class',
                $classId,
                ['teacher_id' => $teacherId]
            );

            $pdo->commit();
            return true;
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