<?php

declare(strict_types=1);

namespace SAMS\Services;

use SAMS\Exceptions\AdministrationException;
use SAMS\Helpers\Database;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\LoginCodeRepository;
use SAMS\Repositories\UserRepository;

final class LoginCodeService
{
    private const PREFIXES = [
        'admin' => 'A',
        'teacher' => 'T',
        'counselor' => 'C',
    ];

    public function __construct(
        private readonly LoginCodeRepository $codes = new LoginCodeRepository(),
        private readonly UserRepository $users = new UserRepository(),
        private readonly AuditLogRepository $audit = new AuditLogRepository(),
    ) {}

    /** @return array{user_id:int,school_id:int,sams_code:string} */
    public function issueForUser(int $adminId, int $userId, int $schoolId): array
    {
        if ($adminId < 1 || $userId < 1 || $schoolId < 1) {
            throw new \InvalidArgumentException('Invalid login-code context.');
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $admin = $this->users->findByIdForUpdate($adminId, $schoolId);
            if ($admin === null || (string)$admin['role'] !== 'admin') {
                throw new AdministrationException('Administrator not found.', 403);
            }

            $user = $this->users->findByIdForUpdate($userId, $schoolId);
            if ($user === null) {
                throw new AdministrationException('User not found.', 404);
            }

            if (
                !(bool)$user['is_active']
                || (string)($user['account_status'] ?? 'active') !== 'active'
            ) {
                throw new AdministrationException('Only active accounts can receive a SAMS Code.', 409);
            }

            if ((string)$user['role'] === 'admin') {
                throw new AdministrationException('Administrators authenticate with their username.', 409);
            }

            $prefix = self::PREFIXES[(string)$user['role']] ?? null;
            if ($prefix === null) {
                throw new AdministrationException('Unsupported user role.', 422);
            }

            if ($this->codes->findActiveForUserForUpdate($userId, $schoolId) !== null) {
                throw new AdministrationException('This user already has a SAMS Code. The code is fixed and cannot be regenerated.', 409);
            }

            $samsCode = null;
            $codeId = null;
            for ($attempt = 0; $attempt < 8; ++$attempt) {
                $candidate = $prefix . str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
                try {
                    $codeId = $this->codes->create(
                        $userId,
                        self::hashCode($candidate),
                        $adminId,
                        $schoolId
                    );
                    $samsCode = $candidate;
                    break;
                } catch (\PDOException $e) {
                    if ((int)($e->errorInfo[1] ?? 0) !== 1062 || $attempt === 7) {
                        throw $e;
                    }
                }
            }

            if ($samsCode === null || $codeId === null) {
                throw new \RuntimeException('Unable to issue a unique SAMS Code.');
            }

            $this->audit->record(
                $adminId,
                'user.sams_code_issued',
                'user',
                $userId,
                ['login_code_id' => $codeId]
            );

            $pdo->commit();

            return [
                'user_id' => $userId,
                'school_id' => $schoolId,
                'sams_code' => $samsCode,
            ];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    /** @return array{user_id:int,school_id:int,sams_code:string} */
    public function issueInitialCode(int $userId, int $schoolId): array
    {
        if ($userId < 1 || $schoolId < 1) {
            throw new \InvalidArgumentException('Invalid login-code context.');
        }

        $pdo = Database::connection();
        $ownTransaction = !$pdo->inTransaction();
        if ($ownTransaction) $pdo->beginTransaction();

        try {
            $user = $this->users->findByIdForUpdate($userId, $schoolId);
            if ($user === null) {
                throw new AdministrationException('User not found.', 404);
            }
            if (
                !(bool)$user['is_active']
                || (string)($user['account_status'] ?? 'active') !== 'active'
            ) {
                throw new AdministrationException('Only active accounts can receive a SAMS Code.', 409);
            }

            if ((string)$user['role'] === 'admin') {
                throw new AdministrationException('Administrators authenticate with their username.', 409);
            }

            $prefix = self::PREFIXES[(string)$user['role']] ?? null;
            if ($prefix === null) {
                throw new AdministrationException('Unsupported user role.', 422);
            }

            if ($this->codes->findActiveForUserForUpdate($userId, $schoolId) !== null) {
                throw new AdministrationException('This user already has a SAMS Code. The code is fixed and cannot be regenerated.', 409);
            }

            $samsCode = null;
            for ($attempt = 0; $attempt < 8; ++$attempt) {
                $candidate = $prefix . str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
                try {
                    $this->codes->create($userId, self::hashCode($candidate), null, $schoolId);
                    $samsCode = $candidate;
                    break;
                } catch (\PDOException $e) {
                    if ((int)($e->errorInfo[1] ?? 0) !== 1062 || $attempt === 7) throw $e;
                }
            }

            if ($samsCode === null) throw new \RuntimeException('Unable to issue a unique SAMS Code.');
            if ($ownTransaction) $pdo->commit();

            return [
                'user_id' => $userId,
                'school_id' => $schoolId,
                'sams_code' => $samsCode,
            ];
        } catch (\Throwable $e) {
            if ($ownTransaction && $pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public static function normalize(string $value): string
    {
        $value = strtoupper(trim($value));
        if (!preg_match('/^[ATC][0-9]{6}$/', $value)) {
            throw new \InvalidArgumentException('Invalid SAMS Code.');
        }
        return $value;
    }

    public static function hashCode(string $code): string
    {
        return hash('sha256', self::normalize($code));
    }
}
