<?php

declare(strict_types=1);

namespace SAMS\Services;

use SAMS\Exceptions\OnboardingWorkflowException;
use SAMS\Helpers\Database;
use SAMS\Helpers\Security;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\OnboardingRepository;
use SAMS\Repositories\UserRepository;

final class OnboardingService
{
    private const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    private const CODE_LENGTH = 12;
    private const CODE_TTL_DAYS = 7;
    private const REQUEST_TTL_HOURS = 24;
    private const RATE_LIMIT_COUNT = 5;
    private const RATE_LIMIT_MINUTES = 15;

    public function __construct(
        private readonly OnboardingRepository $repository = new OnboardingRepository(),
        private readonly UserRepository $users = new UserRepository(),
        private readonly LoginCodeService $loginCodes = new LoginCodeService(),
        private readonly AuditLogRepository $audit = new AuditLogRepository(),
    ) {}

    /** @return array{school_id:int,onboarding_code:string,expires_at:string} */
    public function issueSchoolCode(int $adminId, int $schoolId): array
    {
        if ($adminId < 1 || $schoolId < 1) {
            throw new \InvalidArgumentException('Invalid onboarding code context.');
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $admin = $this->users->findByIdForUpdate($adminId, $schoolId);
            if ($admin === null || (string)$admin['role'] !== 'admin') {
                throw new OnboardingWorkflowException('Administrator not found.', 403);
            }

            if (
                !(bool)$admin['is_active']
                || (string)($admin['account_status'] ?? 'active') !== 'active'
            ) {
                throw new OnboardingWorkflowException('Administrator account is not active.', 403);
            }

            $this->repository->revokeActiveCodesForSchool($schoolId);

            $code = $this->generateOnboardingCode();
            $expiresAt = gmdate('Y-m-d H:i:s', time() + (self::CODE_TTL_DAYS * 86400));
            $codeId = $this->repository->createCode(
                $schoolId,
                self::hashOnboardingCode($code),
                $adminId,
                $expiresAt
            );

            $this->audit->record(
                $adminId,
                'teacher_onboarding.code_issued',
                'school_onboarding_code',
                $codeId,
                ['expires_at' => $expiresAt]
            );

            $pdo->commit();

            return [
                'school_id' => $schoolId,
                'onboarding_code' => $code,
                'expires_at' => $expiresAt,
            ];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    /** @return array{request_id:int,request_token:string,status:string,expires_at:string} */
    public function requestTeacher(
        string $onboardingCode,
        string $fullName,
        ?string $employeeId,
        ?string $phone,
        string $requestIp,
        string $requestUserAgent
    ): array {
        $onboardingCode = self::normalizeOnboardingCode($onboardingCode);
        $fullName = $this->requiredText($fullName, 120, 'full name');
        $employeeId = $this->optionalText($employeeId, 50, 'employee id');
        $phone = $this->optionalText($phone, 30, 'phone');
        $requestIp = filter_var($requestIp, FILTER_VALIDATE_IP) ? $requestIp : '0.0.0.0';
        $requestUserAgent = mb_substr($requestUserAgent, 0, 512);

        if ($requestIp === '0.0.0.0') {
            throw new OnboardingWorkflowException('Invalid request origin.', 400);
        }

        if ($this->repository->countRecentRequestsByIp($requestIp, self::RATE_LIMIT_MINUTES) >= self::RATE_LIMIT_COUNT) {
            throw new OnboardingWorkflowException('Too many onboarding requests. Try again later.', 429);
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $code = $this->repository->findActiveCodeByHashForUpdate(
                self::hashOnboardingCode($onboardingCode)
            );
            if ($code === null) {
                throw new OnboardingWorkflowException('Invalid or expired onboarding code.', 422);
            }

            $expiresAt = gmdate('Y-m-d H:i:s', time() + (self::REQUEST_TTL_HOURS * 3600));
            $requestToken = bin2hex(random_bytes(32));
            $requestId = $this->repository->createRequest(
                (int)$code['school_id'],
                (int)$code['id'],
                hash('sha256', $requestToken),
                $fullName,
                $employeeId,
                $phone,
                $expiresAt,
                $requestIp,
                $requestUserAgent
            );

            $this->audit->record(
                null,
                'teacher_onboarding.requested',
                'teacher_onboarding_request',
                $requestId,
                ['school_id' => (int)$code['school_id']],
                (int)$code['school_id']
            );

            $pdo->commit();

            return [
                'request_id' => $requestId,
                'request_token' => $requestToken,
                'status' => 'pending',
                'expires_at' => $expiresAt,
            ];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public function status(string $requestToken): array
    {
        $requestToken = self::normalizeRequestToken($requestToken);
        $request = $this->repository->findRequestByTokenForUpdate(hash('sha256', $requestToken));
        if ($request === null) {
            throw new OnboardingWorkflowException('Onboarding request not found.', 404);
        }

        if (
            (string)$request['status'] === 'pending'
            && strtotime((string)$request['expires_at']) <= time()
        ) {
            $this->repository->markExpired((int)$request['id'], (int)$request['school_id']);
            $request['status'] = 'expired';
        }

        $activated = false;
        if (($request['created_user_id'] ?? null) !== null) {
            $user = $this->users->findById((int)$request['created_user_id']);
            $activated = $user !== null
                && (string)($user['account_status'] ?? '') === 'active'
                && (bool)$user['is_active'];
        }

        return [
            'request_id' => (int)$request['id'],
            'status' => (string)$request['status'],
            'expires_at' => (string)$request['expires_at'],
            'activated' => $activated,
        ];
    }

    /** @return array{request_id:int,user_id:int,reused:bool,status:string} */
    public function review(
        int $adminId,
        int $requestId,
        string $action,
        ?string $reason,
        int $schoolId
    ): array {
        if ($adminId < 1 || $requestId < 1 || $schoolId < 1) {
            throw new \InvalidArgumentException('Invalid onboarding review context.');
        }
        if (!in_array($action, ['approve', 'reject'], true)) {
            throw new \InvalidArgumentException('Invalid onboarding review action.');
        }
        $reason = $this->optionalText($reason, 255, 'rejection reason');

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $admin = $this->users->findByIdForUpdate($adminId, $schoolId);
            if ($admin === null || (string)$admin['role'] !== 'admin') {
                throw new OnboardingWorkflowException('Administrator not found.', 403);
            }

            $request = $this->repository->findRequestByIdForUpdate($requestId, $schoolId);
            if ($request === null) {
                throw new OnboardingWorkflowException('Onboarding request not found.', 404);
            }

            if ((string)$request['status'] === 'pending' && strtotime((string)$request['expires_at']) <= time()) {
                $this->repository->markExpired($requestId, $schoolId);
                throw new OnboardingWorkflowException('Onboarding request has expired.', 409);
            }

            if ($action === 'reject') {
                if ((string)$request['status'] === 'rejected') {
                    $pdo->commit();
                    return [
                        'request_id' => $requestId,
                        'user_id' => 0,
                        'reused' => false,
                        'status' => 'rejected',
                    ];
                }
                if ((string)$request['status'] !== 'pending') {
                    throw new OnboardingWorkflowException('Only pending requests can be rejected.', 409);
                }

                $this->repository->rejectRequest($requestId, $schoolId, $adminId, $reason);
                $this->audit->record(
                    $adminId,
                    'teacher_onboarding.rejected',
                    'teacher_onboarding_request',
                    $requestId,
                    ['reason_provided' => $reason !== null]
                );
                $pdo->commit();

                return [
                    'request_id' => $requestId,
                    'user_id' => 0,
                    'reused' => false,
                    'status' => 'rejected',
                ];
            }

            if ((string)$request['status'] === 'approved' && (int)($request['created_user_id'] ?? 0) > 0) {
                $pdo->commit();
                return [
                    'request_id' => $requestId,
                    'user_id' => (int)$request['created_user_id'],
                    'reused' => true,
                    'status' => 'approved',
                ];
            }
            if ((string)$request['status'] !== 'pending') {
                throw new OnboardingWorkflowException('Only pending requests can be approved.', 409);
            }

            $user = null;
            $reused = false;
            $employeeId = trim((string)($request['employee_id'] ?? ''));
            if ($employeeId !== '') {
                $user = $this->users->findTeacherByEmployeeIdForUpdate($employeeId, $schoolId);
                $reused = $user !== null;
            }

            if ($user === null) {
                $username = 'onboard.' . $requestId . '.' . bin2hex(random_bytes(4));
                $userId = $this->users->createPendingTeacher(
                    $schoolId,
                    $username,
                    (string)$request['full_name'],
                    $employeeId !== '' ? $employeeId : null,
                    ($request['phone'] ?? null) !== null ? (string)$request['phone'] : null
                );
            } else {
                $userId = (int)$user['id'];
            }

            $this->repository->approveRequest($requestId, $schoolId, $adminId, $userId);
            $this->audit->record(
                $adminId,
                'teacher_onboarding.approved',
                'teacher_onboarding_request',
                $requestId,
                ['user_id' => $userId, 'reused_user' => $reused]
            );
            $pdo->commit();

            return [
                'request_id' => $requestId,
                'user_id' => $userId,
                'reused' => $reused,
                'status' => 'approved',
            ];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    /** @return array{request_id:int,user_id:int,sams_code:string,session_version:int} */
    public function activate(string $requestToken, string $password): array
    {
        $requestToken = self::normalizeRequestToken($requestToken);
        if ($password === '') {
            throw new \InvalidArgumentException('Password is required.');
        }
        if (strlen($password) < 10 || strlen($password) > 255) {
            throw new \InvalidArgumentException('Password must be between 10 and 255 characters.');
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $request = $this->repository->findRequestByTokenForUpdate(hash('sha256', $requestToken));
            if ($request === null) {
                throw new OnboardingWorkflowException('Onboarding request not found.', 404);
            }

            if ((string)$request['status'] === 'pending' && strtotime((string)$request['expires_at']) <= time()) {
                $this->repository->markExpired((int)$request['id'], (int)$request['school_id']);
                throw new OnboardingWorkflowException('Onboarding request has expired.', 409);
            }
            if ((string)$request['status'] !== 'approved') {
                throw new OnboardingWorkflowException('Only approved onboarding requests can be activated.', 409);
            }

            $userId = (int)($request['created_user_id'] ?? 0);
            if ($userId < 1) {
                throw new OnboardingWorkflowException('Approved request has no teacher account.', 409);
            }

            $user = $this->users->findByIdForUpdate($userId, (int)$request['school_id']);
            if ($user === null || (string)$user['role'] !== 'teacher') {
                throw new OnboardingWorkflowException('Teacher account not found.', 404);
            }
            if ((bool)$user['is_active'] && (string)($user['account_status'] ?? '') === 'active') {
                throw new OnboardingWorkflowException('Teacher account is already activated.', 409);
            }

            $version = $this->users->activateFromOnboarding(
                $userId,
                Security::hashPassword($password),
                (int)$request['school_id']
            );
            $code = $this->loginCodes->issueInitialCode($userId, (int)$request['school_id']);

            $this->audit->record(
                $userId,
                'teacher_onboarding.activated',
                'teacher_onboarding_request',
                (int)$request['id'],
                ['user_id' => $userId]
            );

            $pdo->commit();

            return [
                'request_id' => (int)$request['id'],
                'user_id' => $userId,
                'sams_code' => $code['sams_code'],
                'session_version' => $version,
            ];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    /** @return list<array<string,mixed>> */
    public function listRequests(int $adminId, int $schoolId, ?string $status = null): array
    {
        if ($adminId < 1 || $schoolId < 1) throw new \InvalidArgumentException('Invalid onboarding context.');
        if ($status !== null && !in_array($status, ['pending', 'approved', 'rejected', 'expired'], true)) {
            throw new \InvalidArgumentException('Invalid onboarding status.');
        }

        $admin = $this->users->findByIdForUpdate($adminId, $schoolId);
        if ($admin === null || (string)$admin['role'] !== 'admin') {
            throw new OnboardingWorkflowException('Administrator not found.', 403);
        }

        return $this->repository->listRequests($schoolId, $status);
    }

    private function generateOnboardingCode(): string
    {
        $code = '';
        $alphabetLength = strlen(self::CODE_ALPHABET) - 1;
        for ($i = 0; $i < self::CODE_LENGTH; ++$i) {
            $code .= self::CODE_ALPHABET[random_int(0, $alphabetLength)];
        }
        return $code;
    }

    private static function normalizeOnboardingCode(string $value): string
    {
        $value = strtoupper(trim($value));
        if (!preg_match('/^[A-HJ-NP-Z2-9]{12}$/', $value)) {
            throw new \InvalidArgumentException('Invalid onboarding code.');
        }
        return $value;
    }

    private static function hashOnboardingCode(string $value): string
    {
        return hash('sha256', self::normalizeOnboardingCode($value));
    }

    private static function normalizeRequestToken(string $value): string
    {
        $value = strtolower(trim($value));
        if (!preg_match('/^[a-f0-9]{64}$/', $value)) {
            throw new \InvalidArgumentException('Invalid onboarding request token.');
        }
        return $value;
    }

    private function requiredText(string $value, int $max, string $field): string
    {
        $value = trim($value);
        if ($value === '' || mb_strlen($value) > $max) {
            throw new \InvalidArgumentException('Invalid ' . $field . '.');
        }
        return $value;
    }

    private function optionalText(?string $value, int $max, string $field): ?string
    {
        if ($value === null) return null;
        $value = trim($value);
        if ($value === '') return null;
        if (mb_strlen($value) > $max) {
            throw new \InvalidArgumentException('Invalid ' . $field . '.');
        }
        return $value;
    }
}
