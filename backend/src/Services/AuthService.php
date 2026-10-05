<?php

declare(strict_types=1);

namespace SAMS\Services;

use RuntimeException;
use Throwable;
use SAMS\Helpers\Database;
use SAMS\Helpers\Security;
use SAMS\Repositories\LoginCodeRepository;
use SAMS\Repositories\UserRepository;

final class AuthService
{
    private UserRepository $users;
    private LoginCodeRepository $loginCodes;

    public function __construct(
        ?UserRepository $users = null,
        ?LoginCodeRepository $loginCodes = null
    ) {
        $this->users = $users ?? new UserRepository();
        $this->loginCodes = $loginCodes ?? new LoginCodeRepository();
    }

    public function authenticate(
        string $username,
        string $password,
        int $lockMinutes = 5,
        int $maxAttempts = 5,
        ?string $requiredRole = null
    ): array {
        if ($username === '' || $password === '') {
            throw new RuntimeException('Invalid credentials.');
        }

        $lockMinutes = max(1, $lockMinutes);
        $maxAttempts = max(1, min(65535, $maxAttempts));
        $pdo = Database::connection();

        $pdo->beginTransaction();
        try {
            // Lock the account row so concurrent failed requests cannot overwrite
            // each other's failure counters.
            $user = $this->users->findByUsernameForUpdate($username);

            if (
                !$user
                || !(bool)$user['is_active']
                || (string)($user['account_status'] ?? 'active') !== 'active'
            ) {
                $pdo->commit();
                throw new RuntimeException('Invalid credentials.');
            }

            if ($requiredRole !== null && (string)$user['role'] !== $requiredRole) {
                $pdo->commit();
                throw new RuntimeException('Invalid credentials.');
            }

            if ($user['locked_until'] && strtotime((string)$user['locked_until']) > time()) {
                $pdo->commit();
                throw new RuntimeException('Account temporarily locked.');
            }

            if (!Security::verifyPassword($password, (string)$user['password_hash'])) {
                $attempts = min(65535, (int)$user['failed_login_attempts'] + 1);
                $lockSeconds = $lockMinutes * 60;
                $lockedUntil = $attempts >= $maxAttempts
                    ? date('Y-m-d H:i:s', time() + $lockSeconds)
                    : null;

                $this->users->recordLoginFailure((int)$user['id'], $attempts, $lockedUntil);
                $pdo->commit();
                throw new RuntimeException('Invalid credentials.');
            }

            $sessionVersion = (int)$user['session_version'];

            if (Security::shouldRehashPassword((string)$user['password_hash'])) {
                $this->users->updatePasswordHash(
                    (int)$user['id'],
                    Security::hashPassword($password),
                    (int)$user['school_id']
                );
                ++$sessionVersion;
            }

            $this->users->recordLoginSuccess((int)$user['id']);
            $pdo->commit();

            return [
                'id' => (int)$user['id'],
                'school_id' => isset($user['school_id']) ? (int)$user['school_id'] : null,
                'full_name' => (string)$user['full_name'],
                'role' => (string)$user['role'],
                'account_status' => (string)($user['account_status'] ?? ($user['is_active'] ? 'active' : 'deactivated')),
                'session_version' => $sessionVersion,
            ];
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public function authenticateByLoginIdentifier(
        string $identifier,
        string $password,
        int $lockMinutes = 5,
        int $maxAttempts = 5
    ): array {
        $identifier = trim($identifier);
        if ($identifier === '' || $password === '') {
            throw new RuntimeException('Invalid credentials.');
        }

        if (preg_match('/^[TC][0-9]{6}$/i', $identifier) === 1) {
            return $this->authenticateBySamsCode(
                LoginCodeService::normalize($identifier),
                $password,
                $lockMinutes,
                $maxAttempts
            );
        }

        return $this->authenticate(
            $identifier,
            $password,
            $lockMinutes,
            $maxAttempts,
            'admin'
        );
    }

    public function authenticateBySamsCode(
        string $samsCode,
        string $password,
        int $lockMinutes = 5,
        int $maxAttempts = 5
    ): array {
        $samsCode = LoginCodeService::normalize($samsCode);
        if ($password === '') {
            throw new RuntimeException('Invalid credentials.');
        }

        $lockMinutes = max(1, $lockMinutes);
        $maxAttempts = max(1, min(65535, $maxAttempts));
        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $user = $this->loginCodes->findUserByCodeHashForUpdate(
                LoginCodeService::hashCode($samsCode)
            );

            if (
                !$user
                || !(bool)$user['is_active']
                || (string)($user['account_status'] ?? 'active') !== 'active'
                || (string)($user['password_hash'] ?? '') === ''
            ) {
                $pdo->commit();
                throw new RuntimeException('Invalid credentials.');
            }

            if ((string)$user['role'] === 'admin') {
                $pdo->commit();
                throw new RuntimeException('Invalid credentials.');
            }

            if ($user['locked_until'] && strtotime((string)$user['locked_until']) > time()) {
                $pdo->commit();
                throw new RuntimeException('Account temporarily locked.');
            }

            if (!Security::verifyPassword($password, (string)$user['password_hash'])) {
                $attempts = min(65535, (int)$user['failed_login_attempts'] + 1);
                $lockedUntil = $attempts >= $maxAttempts
                    ? date('Y-m-d H:i:s', time() + ($lockMinutes * 60))
                    : null;
                $this->users->recordLoginFailure((int)$user['id'], $attempts, $lockedUntil);
                $pdo->commit();
                throw new RuntimeException('Invalid credentials.');
            }

            $sessionVersion = (int)$user['session_version'];
            if (Security::shouldRehashPassword((string)$user['password_hash'])) {
                $this->users->updatePasswordHash(
                    (int)$user['id'],
                    Security::hashPassword($password),
                    (int)$user['school_id']
                );
                ++$sessionVersion;
            }

            $this->users->recordLoginSuccess((int)$user['id']);
            $pdo->commit();

            return [
                'id' => (int)$user['id'],
                'school_id' => (int)$user['school_id'],
                'full_name' => (string)$user['full_name'],
                'role' => (string)$user['role'],
                'account_status' => (string)($user['account_status'] ?? 'active'),
                'session_version' => $sessionVersion,
            ];
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }
}