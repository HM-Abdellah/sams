<?php

declare(strict_types=1);

namespace SAMS\Services;

use SAMS\Exceptions\AdministrationException;
use SAMS\Helpers\Database;
use SAMS\Repositories\AcademicYearRepository;
use SAMS\Repositories\AuditLogRepository;

final class AcademicYearAdministrationService
{
    public function __construct(
        private readonly AcademicYearRepository $repository = new AcademicYearRepository(),
        private readonly AcademicYearService $validator = new AcademicYearService(),
        private readonly AuditLogRepository $audit = new AuditLogRepository(),
    ) {}

    public function list(?int $schoolId = null): array
    {
        $this->assertSchoolIdWhenProvided($schoolId);
        return $this->repository->all($schoolId);
    }

    public function create(
        int $adminId,
        string $name,
        string $startsOn,
        string $endsOn,
        bool $activate = false,
        ?int $schoolId = null
    ): int {
        $this->assertAdminId($adminId);
        $this->assertSchoolIdWhenProvided($schoolId);

        $name = $this->validator->validateName($name);
        [$startsOn, $endsOn] = $this->validator->validateRange($startsOn, $endsOn);

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $this->repository->activeForUpdate($schoolId);

            if ($this->repository->overlaps($startsOn, $endsOn, null, $schoolId)) {
                throw new AdministrationException(
                    'Academic year dates overlap an existing academic year.',
                    409
                );
            }

            $id = $this->repository->create($name, $startsOn, $endsOn, $schoolId);

            if ($activate) {
                $this->repository->deactivateAll($schoolId);
                $this->repository->activate($id, $schoolId);
            }

            $this->audit->record(
                $adminId,
                'academic_year.create',
                'academic_year',
                $id,
                ['activate' => $activate]
            );

            $pdo->commit();

            return $id;
        } catch (AdministrationException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        } catch (\PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                throw new AdministrationException('Academic year already exists.', 409);
            }
            throw $e;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public function activate(
        int $adminId,
        int $yearId,
        ?int $schoolId = null
    ): void {
        $this->assertAdminId($adminId);
        $this->assertSchoolIdWhenProvided($schoolId);
        if ($yearId < 1) {
            throw new \InvalidArgumentException('Invalid academic year.');
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $this->repository->activeForUpdate($schoolId);

            $target = $this->repository->findForUpdate($yearId, $schoolId);
            if ($target === null) {
                throw new AdministrationException('Academic year not found.', 404);
            }

            if ($this->repository->overlaps(
                (string)$target['starts_on'],
                (string)$target['ends_on'],
                $yearId,
                $schoolId
            )) {
                throw new AdministrationException(
                    'Academic year dates overlap an existing academic year.',
                    409
                );
            }

            $this->repository->deactivateAll($schoolId);
            $this->repository->activate($yearId, $schoolId);

            $this->audit->record(
                $adminId,
                'academic_year.activate',
                'academic_year',
                $yearId
            );

            $pdo->commit();
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