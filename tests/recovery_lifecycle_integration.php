<?php

declare(strict_types=1);

require_once __DIR__ . '/../backend/vendor/autoload.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Database;
use SAMS\Helpers\Security;
use SAMS\Repositories\UserRepository;
use SAMS\Services\AuthService;
use SAMS\Services\LoginCodeService;
use SAMS\Services\UserAdministrationService;
use SAMS\Exceptions\AdministrationException;

function recovery_assert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function recovery_expect(callable $callback, string $message): void
{
    try {
        $callback();
    } catch (Throwable) {
        return;
    }
    throw new RuntimeException($message);
}

$pdo = Database::connection();
$pdo->exec('SET FOREIGN_KEY_CHECKS=0');
foreach (['sams_login_codes','audit_logs','users','schools'] as $table) {
    $pdo->exec('TRUNCATE TABLE `' . $table . '`');
}
$pdo->exec('SET FOREIGN_KEY_CHECKS=1');
$pdo->exec("INSERT INTO schools (code, name, status) VALUES ('REC-A', 'Recovery A', 'active')");
$schoolId = (int)$pdo->lastInsertId();

$users = new UserRepository();
$adminId = $users->create('recovery-admin', 'Recovery Admin', Security::hashPassword('RecoveryAdmin123!'), 'admin', null, null, $schoolId);
$teacherId = $users->create('recovery-teacher', 'Recovery Teacher', Security::hashPassword('RecoveryTeacher123!'), 'teacher', 'REC-001', null, $schoolId);

$codes = new LoginCodeService();
$issued = $codes->issueForUser($adminId, $teacherId, $schoolId);
$auth = new AuthService();
$admin = new UserAdministrationService();

$authenticated = $auth->authenticateBySamsCode($issued['sams_code'], 'RecoveryTeacher123!');
recovery_assert($authenticated['id'] === $teacherId, 'Initial recovery test login failed.');
$initialVersion = (int)$authenticated['session_version'];

Security::startSession('SAMS_RECOVERY_TEST', 3600);
Auth::login($authenticated);
recovery_assert(Auth::check(), 'Authenticated session was not established for recovery test.');

$admin->revokeSessions($adminId, $teacherId, $schoolId);
recovery_assert(!Auth::check(), 'Explicit session revocation did not invalidate the active session.');
$afterRevokeVersion = (int)$pdo->query("SELECT session_version FROM users WHERE id = {$teacherId}")->fetchColumn();
recovery_assert($afterRevokeVersion === $initialVersion + 1, 'Session revocation did not increment session_version exactly once.');

$admin->setStatus($adminId, $teacherId, 'suspended', $schoolId);
$status = $pdo->query("SELECT account_status, is_active, session_version FROM users WHERE id = {$teacherId}")->fetch();
recovery_assert($status['account_status'] === 'suspended' && (int)$status['is_active'] === 0, 'Suspension did not synchronize account lifecycle state.');
recovery_assert((int)$status['session_version'] === $afterRevokeVersion + 1, 'Suspension did not invalidate sessions.');
recovery_expect(
    static fn() => $auth->authenticateBySamsCode($issued['sams_code'], 'RecoveryTeacher123!'),
    'Suspended account authenticated successfully.'
);

$reactivated = $admin->setStatus($adminId, $teacherId, 'active', $schoolId);
recovery_assert($reactivated['status'] === 'active', 'Reactivation did not return active status.');
$active = $pdo->query("SELECT account_status, is_active, session_version FROM users WHERE id = {$teacherId}")->fetch();
recovery_assert($active['account_status'] === 'active' && (int)$active['is_active'] === 1, 'Reactivation did not synchronize active lifecycle state.');
recovery_assert((int)$active['session_version'] === (int)$status['session_version'] + 1, 'Reactivation did not invalidate sessions.');

$auth->authenticateBySamsCode($issued['sams_code'], 'RecoveryTeacher123!');

$admin->resetPassword($adminId, $teacherId, 'RecoveryReset123!', $schoolId);
recovery_expect(
    static fn() => $auth->authenticateBySamsCode($issued['sams_code'], 'RecoveryTeacher123!'),
    'Old password remained valid after administrator password reset.'
);
$resetLogin = $auth->authenticateBySamsCode($issued['sams_code'], 'RecoveryReset123!');
recovery_assert($resetLogin['id'] === $teacherId, 'New password did not authenticate after reset.');

$beforeSameStatus = (int)$pdo->query("SELECT session_version FROM users WHERE id = {$teacherId}")->fetchColumn();
$sameStatus = $admin->setStatus($adminId, $teacherId, 'active', $schoolId);
recovery_assert((int)$sameStatus['session_version'] === $beforeSameStatus, 'Idempotent same-status update changed session_version unexpectedly.');

$schoolB = $pdo->exec("INSERT INTO schools (code, name, status) VALUES ('REC-B', 'Recovery B', 'active')") ? (int)$pdo->lastInsertId() : 0;
$adminB = $users->create('recovery-admin-b', 'Recovery Admin B', Security::hashPassword('RecoveryAdmin123!'), 'admin', null, null, $schoolB);
recovery_expect(
    static fn() => $admin->revokeSessions($adminB, $teacherId, $schoolB),
    'Cross-school session revocation was accepted.'
);

$audited = (int)$pdo->query("SELECT COUNT(*) FROM audit_logs WHERE action IN ('user.sessions_revoked','user.status_change','user.password_reset') AND school_id = {$schoolId}")->fetchColumn();
recovery_assert($audited >= 3, 'Recovery/lifecycle security mutations were not audited in the correct tenant.');

echo "[PASS] Recovery and lifecycle: session revocation, suspension/reactivation, password reset invalidation, idempotent status, cross-tenant denial, and audit ownership verified." . PHP_EOL;
