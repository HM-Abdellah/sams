<?php

declare(strict_types=1);

namespace SAMS\Services;

use PDOException;
use SAMS\Exceptions\SetupWorkflowException;
use SAMS\Helpers\Audit;
use SAMS\Helpers\Database;
use SAMS\Helpers\Security;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\SetupRepository;

final class SetupService
{
    private const MIN_SETUP_KEY_LENGTH = 32;

    private readonly string $setupKey;

    public function __construct(
        private readonly SetupRepository $repository = new SetupRepository(),
        private readonly UserService $users = new UserService(),
        private readonly AuditLogRepository $audit = new AuditLogRepository(),
        ?string $setupKey = null
    ) {
        $this->setupKey = trim(
            $setupKey
            ?? (string)($GLOBALS['appConfig']['setup_key'] ?? getenv('SAMS_SETUP_KEY') ?: '')
        );
    }

    /** @return array{available:bool,configured:bool,initialized:bool} */
    public function status(): array
    {
        $state = $this->repository->installationState();
        $initialized = $state['schools'] > 0 || $state['admins'] > 0;
        $configured = strlen($this->setupKey) >= self::MIN_SETUP_KEY_LENGTH;

        return [
            'available' => !$initialized && $configured,
            'configured' => $configured,
            'initialized' => $initialized,
        ];
    }

    /** @return array{school_id:int,admin_id:int,username:string,initialized:bool} */
    public function initialize(
        string $setupKey,
        string $schoolCode,
        string $schoolName,
        string $username,
        string $fullName,
        string $password
    ): array {
        if (strlen($this->setupKey) < self::MIN_SETUP_KEY_LENGTH) {
            throw new SetupWorkflowException(
                'First-time setup is not enabled on this installation.',
                503
            );
        }

        if ($setupKey === '' || !hash_equals($this->setupKey, $setupKey)) {
            throw new SetupWorkflowException('Invalid setup key.', 403);
        }

        $schoolCode = $this->validateSchoolCode($schoolCode);
        $schoolName = $this->validateSchoolName($schoolName);
        $username = $this->users->validateUsername($username);
        $fullName = $this->users->validateFullName($fullName);
        $password = $this->users->validatePassword($password);

        if (!$this->repository->acquireLock()) {
            throw new SetupWorkflowException(
                'Another first-time setup is already in progress. Try again.',
                409
            );
        }

        $pdo = Database::connection();

        try {
            $state = $this->repository->installationState();
            if ($state['schools'] > 0 || $state['admins'] > 0) {
                throw new SetupWorkflowException(
                    'First-time setup has already been completed on this installation.',
                    409
                );
            }

            $pdo->beginTransaction();

            try {
                if ($this->repository->schoolCodeExists($schoolCode)) {
                    throw new SetupWorkflowException(
                        'That school code already exists.',
                        409
                    );
                }

                if ($this->repository->usernameExists($username)) {
                    throw new SetupWorkflowException(
                        'That username already exists.',
                        409
                    );
                }

                $schoolId = $this->repository->createSchool($schoolCode, $schoolName);
                $adminId = $this->repository->createAdmin(
                    $schoolId,
                    $username,
                    $fullName,
                    Security::hashPassword($password)
                );

                $this->audit->record(
                    null,
                    Audit::actionName('system.bootstrap_admin'),
                    'user',
                    $adminId,
                    [
                        'username' => $username,
                        'bootstrap' => true,
                        'method' => 'web_setup',
                    ],
                    $schoolId
                );

                $pdo->commit();
            } catch (\Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }

                if ($e instanceof SetupWorkflowException) {
                    throw $e;
                }

                if ($e instanceof PDOException && (int)($e->errorInfo[1] ?? 0) === 1062) {
                    throw new SetupWorkflowException(
                        'The school code or username is already in use.',
                        409,
                        $e
                    );
                }

                throw $e;
            }

            return [
                'school_id' => $schoolId,
                'admin_id' => $adminId,
                'username' => $username,
                'initialized' => true,
            ];
        } finally {
            try {
                $this->repository->releaseLock();
            } catch (\Throwable) {
                // Do not mask the setup result with a lock-release failure.
            }
        }
    }

    private function validateSchoolCode(string $code): string
    {
        $code = trim($code);

        if (
            $code === ''
            || strlen($code) > 20
            || !preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]*$/', $code)
        ) {
            throw new \InvalidArgumentException(
                'School code must be 1-20 characters and contain only letters, numbers, "_" or "-".'
            );
        }

        return $code;
    }

    private function validateSchoolName(string $name): string
    {
        $name = trim((string)(preg_replace('/\s+/u', ' ', $name) ?? ''));

        if ($name === '' || mb_strlen($name) > 150) {
            throw new \InvalidArgumentException('Invalid school name.');
        }

        return $name;
    }
}

