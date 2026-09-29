<?php

declare(strict_types=1);

namespace SAMS\Services;

use SAMS\Exceptions\AdministrationException;
use SAMS\Helpers\Database;
use SAMS\Helpers\Security;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\UserRepository;

final class UserAdministrationService
{
    public function __construct(
        private readonly UserRepository $repository = new UserRepository(),
        private readonly UserService $validator = new UserService(),
        private readonly TeacherService $teacherValidator = new TeacherService(),
        private readonly AuditLogRepository $audit = new AuditLogRepository(),
    ) {}

    public function list(?int $schoolId = null): array
    {
        $this->assertSchoolIdWhenProvided($schoolId);
        return $this->repository->forAdmin($schoolId);
    }

    public function create(
        int $adminId,
        string $username,
        string $fullName,
        string $role,
        string $password,
        ?string $employeeId = null,
        ?string $phone = null,
        ?int $schoolId = null
    ): int {
        $this->assertAdminId($adminId);
        $schoolId = $this->requireSchoolId($schoolId);

        $username = $this->validator->validateUsername($username);
        $fullName = $this->validator->validateFullName($fullName);
        $role = $this->validator->validateRole($role);
        $password = $this->validator->validatePassword($password);

        if ($role === 'teacher') {
            $employeeId = $this->teacherValidator->validateEmployeeId($employeeId ?? $username);
            $phone = $this->teacherValidator->validatePhone($phone);
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $id = $this->repository->create(
                $username,
                $fullName,
                Security::hashPassword($password),
                $role,
                $employeeId,
                $phone,
                $schoolId
            );

            $this->audit->record(
                $adminId,
                'user.create',
                'user',
                $id,
                ['role' => $role]
            );

            $pdo->commit();

            return $id;
        } catch (\PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();

            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                throw new AdministrationException('Username or employee ID already exists.', 409);
            }

            throw $e;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public function update(
        int $adminId,
        int $userId,
        ?string $fullName = null,
        ?string $role = null,
        ?bool $isActive = null,
        ?string $employeeId = null,
        ?string $phone = null,
        ?int $schoolId = null
    ): int {
        $this->assertAdminId($adminId);
        $schoolId = $this->requireSchoolId($schoolId);
        if ($userId < 1) {
            throw new \InvalidArgumentException('Invalid user.');
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $existing = $this->repository->findByIdForUpdate($userId, $schoolId);
            if ($existing === null) {
                throw new AdministrationException('User not found.', 404);
            }

            $fullName = $this->validator->validateFullName(
                $fullName === null ? (string)$existing['full_name'] : $fullName
            );
            $role = $this->validator->validateRole(
                $role === null ? (string)$existing['role'] : $role
            );
            $isActive = $isActive ?? (bool)$existing['is_active'];

            if ($userId === $adminId && !$isActive) {
                throw new AdministrationException(
                    'You cannot deactivate your own account.',
                    409
                );
            }

            $removingAdminAccess =
                (string)$existing['role'] === 'admin' && $role !== 'admin';
            $deactivatingAdmin =
                (string)$existing['role'] === 'admin' && !$isActive;

            if ($removingAdminAccess || $deactivatingAdmin) {
                $activeAdmins = $this->repository->activeAdminIdsForUpdate($schoolId);
                if (count($activeAdmins) <= 1) {
                    throw new AdministrationException(
                        'The system must keep at least one active administrator.',
                        409
                    );
                }
            }

            $currentEmployeeId = (string)($existing['employee_id'] ?? '');
            $currentPhone = (string)($existing['phone'] ?? '');

            if ($role === 'teacher') {
                $employeeId = $this->teacherValidator->validateEmployeeId(
                    $employeeId ?? ($currentEmployeeId !== '' ? $currentEmployeeId : (string)$existing['username'])
                );
                $phone = $this->teacherValidator->validatePhone(
                    $phone !== null ? $phone : ($currentPhone !== '' ? $currentPhone : null)
                );
            } elseif ($employeeId !== null) {
                $employeeId = $this->teacherValidator->validateEmployeeId($employeeId);
            } else {
                $employeeId = $currentEmployeeId !== '' ? $currentEmployeeId : null;
            }

            if ($phone === null && $currentPhone !== '' && $role === 'teacher') {
                $phone = $currentPhone;
            }

            $username = $role === 'teacher'
                ? (string)$employeeId
                : (string)$existing['username'];

            $this->repository->updateProfile(
                $userId,
                $fullName,
                $role,
                $isActive,
                $username,
                $employeeId,
                $phone,
                $schoolId
            );

            $this->audit->record(
                $adminId,
                'user.update',
                'user',
                $userId,
                ['role' => $role, 'is_active' => $isActive]
            );

            $pdo->commit();

            return $userId;
        } catch (AdministrationException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        } catch (\PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();

            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                throw new AdministrationException('Username or employee ID already exists.', 409);
            }

            throw $e;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public function resetPassword(
        int $adminId,
        int $userId,
        string $password,
        ?int $schoolId = null
    ): void {
        $this->assertAdminId($adminId);
        $schoolId = $this->requireSchoolId($schoolId);
        if ($userId < 1) {
            throw new \InvalidArgumentException('Invalid user.');
        }

        $password = $this->validator->validatePassword($password);
        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $existing = $this->repository->findByIdForUpdate($userId, $schoolId);
            if ($existing === null) {
                throw new AdministrationException('User not found.', 404);
            }

            $this->repository->updatePasswordHash(
                $userId,
                Security::hashPassword($password),
                $schoolId
            );

            $this->audit->record($adminId, 'user.password_reset', 'user', $userId);

            $pdo->commit();
        } catch (AdministrationException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public function unlock(
        int $adminId,
        int $userId,
        ?int $schoolId = null
    ): void {
        $this->assertAdminId($adminId);
        $schoolId = $this->requireSchoolId($schoolId);
        if ($userId < 1) {
            throw new \InvalidArgumentException('Invalid user.');
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $existing = $this->repository->findByIdForUpdate($userId, $schoolId);
            if ($existing === null) {
                throw new AdministrationException('User not found.', 404);
            }

            $this->repository->unlock($userId, $schoolId);
            $this->audit->record($adminId, 'user.unlock', 'user', $userId);

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

    private function requireSchoolId(?int $schoolId): int
    {
        if ($schoolId === null || $schoolId < 1) {
            throw new \InvalidArgumentException('Authenticated school scope is required.');
        }

        return $schoolId;
    }
}