<?php

declare(strict_types=1);

namespace SAMS\Services;

use SAMS\Exceptions\AdministrationException;
use SAMS\Helpers\Database;
use SAMS\Repositories\AcademicYearRepository;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\ClassRepository;

final class ClassAdministrationService
{
    public function __construct(
        private readonly ClassRepository $repository = new ClassRepository(),
        private readonly AcademicYearRepository $academicYears = new AcademicYearRepository(),
        private readonly ClassService $validator = new ClassService(),
        private readonly AuditLogRepository $audit = new AuditLogRepository(),
    ) {}

    public function list(?int $schoolId = null): array
    {
        if ($schoolId !== null && $schoolId < 1) {
            throw new \InvalidArgumentException('Invalid school.');
        }

        return $this->repository->allForAdmin($schoolId);
    }

    public function create(
        int $adminId,
        string $name,
        ?string $level = null,
        ?string $branch = null,
        ?int $schoolId = null
    ): int {
        $this->assertAdminId($adminId);
        $this->assertSchoolIdWhenProvided($schoolId);

        $name = $this->validator->normalizeName($name);
        $level = $this->validator->optionalText($level, 50);
        $branch = $this->validator->optionalText($branch, 100);

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $this->academicYears->activeForUpdate($schoolId);
            $activeYear = $this->academicYears->findActive($schoolId);

            if ($activeYear === null) {
                throw new AdministrationException('No active academic year configured.', 422);
            }

            $id = $this->repository->create(
                (int)$activeYear['id'],
                $name,
                $level,
                $branch
            );

            $this->audit->record(
                $adminId,
                'class.create',
                'class',
                $id,
                ['academic_year_id' => (int)$activeYear['id']]
            );

            $pdo->commit();

            return $id;
        } catch (\PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();

            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                throw new AdministrationException(
                    'A class with this name already exists for the active academic year.',
                    409
                );
            }

            throw $e;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public function update(
        int $adminId,
        int $classId,
        ?string $name = null,
        ?string $level = null,
        ?string $branch = null,
        ?int $schoolId = null
    ): int {
        $this->assertAdminId($adminId);
        $this->assertSchoolIdWhenProvided($schoolId);
        if ($classId < 1) {
            throw new \InvalidArgumentException('Invalid class.');
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $existing = $this->repository->findForUpdate($classId, $schoolId);
            if ($existing === null) {
                throw new AdministrationException('Class not found.', 404);
            }

            $name = $this->validator->normalizeName(
                $name === null ? (string)$existing['name'] : $name
            );
            $level = $this->validator->optionalText(
                $level === null ? (string)($existing['level'] ?? '') : $level,
                50
            );
            $branch = $this->validator->optionalText(
                $branch === null ? (string)($existing['branch'] ?? '') : $branch,
                100
            );

            $this->repository->update($classId, $name, $level, $branch);

            $this->audit->record($adminId, 'class.update', 'class', $classId);

            $pdo->commit();

            return $classId;
        } catch (AdministrationException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        } catch (\PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();

            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                throw new AdministrationException(
                    'A class with this name already exists for the academic year.',
                    409
                );
            }

            throw $e;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public function setActive(
        int $adminId,
        int $classId,
        bool $active,
        ?int $schoolId = null
    ): bool {
        $this->assertAdminId($adminId);
        $this->assertSchoolIdWhenProvided($schoolId);
        if ($classId < 1) {
            throw new \InvalidArgumentException('Invalid class.');
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $existing = $this->repository->findForUpdate($classId, $schoolId);
            if ($existing === null) {
                throw new AdministrationException('Class not found.', 404);
            }

            if ((bool)$existing['is_active'] === $active) {
                $pdo->rollBack();
                return false;
            }

            $this->repository->setActive($classId, $active);

            $this->audit->record(
                $adminId,
                $active ? 'class.activate' : 'class.deactivate',
                'class',
                $classId
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

    private function assertAdminId(int $adminId): void
    {
        if ($adminId < 1) {
            throw new \InvalidArgumentException('Invalid administrator.');
        }
    }

    private function assertSchoolIdWhenProvided(?int $schoolId): void
    {
        if ($schoolId !== null && $schoolId < 1) {
            throw new \InvalidArgumentException('Invalid school.');
        }
    }
}