<?php

declare(strict_types=1);

require_once __DIR__ . '/../backend/vendor/autoload.php';

use SAMS\Helpers\Database;
use SAMS\Helpers\Security;
use SAMS\Repositories\UserRepository;
use SAMS\Services\AuthService;
use SAMS\Services\OnboardingService;
use SAMS\Exceptions\OnboardingWorkflowException;

function onboarding_assert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function onboarding_expect_status(callable $callback, int $status, string $message): void
{
    try {
        $callback();
    } catch (Throwable $e) {
        $actual = $e instanceof OnboardingWorkflowException ? $e->httpStatus() : 422;
        onboarding_assert($actual === $status, $message . ' Wrong status: ' . $actual);
        return;
    }
    throw new RuntimeException($message);
}

$pdo = Database::connection();
$pdo->exec('SET FOREIGN_KEY_CHECKS=0');
foreach (['teacher_onboarding_requests','school_onboarding_codes','sams_login_codes','audit_logs','users','schools'] as $table) {
    $pdo->exec('TRUNCATE TABLE `' . $table . '`');
}
$pdo->exec('SET FOREIGN_KEY_CHECKS=1');

$pdo->exec("INSERT INTO schools (code, name, status) VALUES ('ONB-A', 'Onboarding School A', 'active'), ('ONB-B', 'Onboarding School B', 'active')");
$schools = $pdo->query("SELECT code, id FROM schools WHERE code IN ('ONB-A','ONB-B')")->fetchAll(PDO::FETCH_KEY_PAIR);
$schoolA = (int)$schools['ONB-A'];
$schoolB = (int)$schools['ONB-B'];

$users = new UserRepository();
$adminA = $users->create('onb-admin-a', 'Onboarding Admin A', Security::hashPassword('AdminOnboarding123!'), 'admin', null, null, $schoolA);
$adminB = $users->create('onb-admin-b', 'Onboarding Admin B', Security::hashPassword('AdminOnboarding123!'), 'admin', null, null, $schoolB);

$service = new OnboardingService();

$issued = $service->issueSchoolCode($adminA, $schoolA);
onboarding_assert(preg_match('/^[A-HJ-NP-Z2-9]{12}$/', $issued['onboarding_code']) === 1, 'Generated onboarding code has invalid format.');
onboarding_assert((int)$issued['school_id'] === $schoolA, 'Generated onboarding code has wrong school.');
onboarding_assert((int)$pdo->query("SELECT COUNT(*) FROM school_onboarding_codes WHERE school_id = {$schoolA} AND revoked_at IS NULL")->fetchColumn() === 1, 'Exactly one active school onboarding code should exist.');
onboarding_assert(
    (int)$pdo->query("SELECT COUNT(*) FROM school_onboarding_codes WHERE code_hash = " . $pdo->quote($issued['onboarding_code']))->fetchColumn() === 0,
    'Plaintext onboarding code was stored.'
);

$requestIp = '198.51.100.10';
$request = $service->requestTeacher(
    $issued['onboarding_code'],
    'Pending Teacher',
    'EMP-ONB-001',
    '+212600000001',
    $requestIp,
    'SAMS-Test-Agent/1.0'
);
onboarding_assert($request['status'] === 'pending', 'New teacher onboarding request must be pending.');
onboarding_assert(strlen($request['request_token']) === 64, 'Request token must be 32 random bytes encoded as hex.');
$storedTokenHash = (string)$pdo->query("SELECT request_token_hash FROM teacher_onboarding_requests WHERE id = {$request['request_id']}")->fetchColumn();
onboarding_assert($storedTokenHash === hash('sha256', $request['request_token']), 'Request token hash was not stored correctly.');
onboarding_assert($storedTokenHash !== $request['request_token'], 'Plaintext request token was stored.');

$auditSchool = $pdo->query("SELECT school_id FROM audit_logs WHERE action = 'teacher_onboarding.requested' AND entity_id = {$request['request_id']} ORDER BY id DESC LIMIT 1")->fetchColumn();
onboarding_assert((int)$auditSchool === $schoolA, 'Anonymous onboarding audit lost tenant ownership.');

onboarding_expect_status(
    static fn() => $service->requestTeacher('AAAAAAAAAAAA', 'Invalid', null, null, '198.51.100.20', 'test'),
    422,
    'Invalid onboarding code was accepted.'
);

for ($i = 0; $i < 4; ++$i) {
    $service->requestTeacher(
        $issued['onboarding_code'],
        'Rate Limit Teacher ' . $i,
        null,
        null,
        $requestIp,
        'SAMS-Test-Agent/1.0'
    );
}
onboarding_expect_status(
    static fn() => $service->requestTeacher(
        $issued['onboarding_code'],
        'Rate Limit Overflow',
        null,
        null,
        $requestIp,
        'SAMS-Test-Agent/1.0'
    ),
    429,
    'Onboarding rate limit did not reject the sixth request from the same IP.'
);

onboarding_expect_status(
    static fn() => $service->review($adminB, (int)$request['request_id'], 'approve', null, $schoolB),
    404,
    'Cross-school administrator accessed another school onboarding request.'
);

$approval = $service->review($adminA, (int)$request['request_id'], 'approve', null, $schoolA);
onboarding_assert($approval['status'] === 'approved', 'Teacher onboarding approval did not transition to approved.');
onboarding_assert($approval['reused'] === false, 'First approval unexpectedly reused a teacher.');
$pendingTeacherId = (int)$approval['user_id'];
$pendingTeacher = $pdo->query("SELECT school_id, role, account_status, is_active, password_hash FROM users WHERE id = {$pendingTeacherId}")->fetch();
onboarding_assert((int)$pendingTeacher['school_id'] === $schoolA, 'Approved teacher account has wrong tenant.');
onboarding_assert($pendingTeacher['role'] === 'teacher', 'Approved onboarding account is not a teacher.');
onboarding_assert($pendingTeacher['account_status'] === 'deactivated' && (int)$pendingTeacher['is_active'] === 0, 'Approved teacher must wait for activation.');
onboarding_assert($pendingTeacher['password_hash'] === null, 'Pending teacher account unexpectedly has a password.');

$secondRequest = $service->requestTeacher(
    $issued['onboarding_code'],
    'Same Employee Teacher',
    'EMP-ONB-001',
    '+212600000002',
    '198.51.100.11',
    'SAMS-Test-Agent/1.0'
);
$secondApproval = $service->review($adminA, (int)$secondRequest['request_id'], 'approve', null, $schoolA);
onboarding_assert((int)$secondApproval['user_id'] === $pendingTeacherId, 'Approval did not reuse the existing teacher identity.');
onboarding_assert($secondApproval['reused'] === true, 'Existing teacher identity was not marked as reused.');
onboarding_assert((int)$pdo->query("SELECT COUNT(*) FROM users WHERE school_id = {$schoolA} AND employee_id = 'EMP-ONB-001'")->fetchColumn() === 1, 'Teacher onboarding created duplicate user identities.');

$statusBeforeActivation = $service->status($secondRequest['request_token']);
onboarding_assert($statusBeforeActivation['status'] === 'approved' && $statusBeforeActivation['activated'] === false, 'Approved request status is incorrect before activation.');

$activation = $service->activate($secondRequest['request_token'], 'TeacherActivate123!');
onboarding_assert($activation['user_id'] === $pendingTeacherId, 'Activation returned a different user identity.');
onboarding_assert(preg_match('/^T[0-9]{6}$/', $activation['sams_code']) === 1, 'Activation did not issue a valid teacher SAMS Code.');
$activeTeacher = $pdo->query("SELECT account_status, is_active, password_hash, session_version FROM users WHERE id = {$pendingTeacherId}")->fetch();
onboarding_assert($activeTeacher['account_status'] === 'active' && (int)$activeTeacher['is_active'] === 1, 'Teacher activation did not enable the account.');
onboarding_assert(password_verify('TeacherActivate123!', (string)$activeTeacher['password_hash']), 'Activation did not persist the selected password.');
onboarding_assert((int)$activeTeacher['session_version'] === 2, 'Activation did not increment session_version exactly once.');
onboarding_assert((int)$pdo->query("SELECT COUNT(*) FROM sams_login_codes WHERE user_id = {$pendingTeacherId} AND revoked_at IS NULL")->fetchColumn() === 1, 'Activated teacher must have exactly one active SAMS Code.');

$authenticated = (new AuthService())->authenticateBySamsCode($activation['sams_code'], 'TeacherActivate123!');
onboarding_assert((int)$authenticated['id'] === $pendingTeacherId, 'Activated teacher SAMS Code login returned the wrong identity.');
onboarding_assert((int)$authenticated['school_id'] === $schoolA, 'Activated teacher SAMS Code login returned the wrong tenant.');

$activeDuplicateRequest = $service->requestTeacher(
    $issued['onboarding_code'],
    'Duplicate Active Teacher',
    'EMP-ONB-001',
    null,
    '198.51.100.40',
    'SAMS-Test-Agent/1.0'
);
onboarding_expect_status(
    static fn() => $service->review($adminA, (int)$activeDuplicateRequest['request_id'], 'approve', null, $schoolA),
    409,
    'Onboarding approval reused an already-active teacher identity.'
);

onboarding_expect_status(
    static fn() => $service->activate($secondRequest['request_token'], 'TeacherActivate123!'),
    409,
    'Activated onboarding request could be activated a second time.'
);

$rotatedCode = $service->issueSchoolCode($adminA, $schoolA);
onboarding_expect_status(
    static fn() => $service->requestTeacher(
        $issued['onboarding_code'],
        'Old Code Teacher',
        null,
        null,
        '198.51.100.30',
        'SAMS-Test-Agent/1.0'
    ),
    422,
    'Revoked school onboarding code remained usable.'
);

$rejectRequest = $service->requestTeacher(
    $rotatedCode['onboarding_code'],
    'Rejected Teacher',
    'EMP-REJECT-001',
    null,
    '198.51.100.31',
    'SAMS-Test-Agent/1.0'
);
$rejected = $service->review($adminA, (int)$rejectRequest['request_id'], 'reject', 'Not yet assigned to school.', $schoolA);
onboarding_assert($rejected['status'] === 'rejected', 'Reject action did not persist rejected state.');
onboarding_assert($service->status($rejectRequest['request_token'])['status'] === 'rejected', 'Rejected request status endpoint is incorrect.');

$expireRequest = $service->requestTeacher(
    $rotatedCode['onboarding_code'],
    'Expired Teacher',
    null,
    null,
    '198.51.100.32',
    'SAMS-Test-Agent/1.0'
);
$pdo->exec("UPDATE teacher_onboarding_requests SET expires_at = '2000-01-01 00:00:00' WHERE id = " . (int)$expireRequest['request_id']);
$statusExpired = $service->status($expireRequest['request_token']);
onboarding_assert($statusExpired['status'] === 'expired', 'Expired onboarding request was not transitioned to expired.');
onboarding_expect_status(
    static fn() => $service->activate($expireRequest['request_token'], 'ExpiredActivate123!'),
    409,
    'Expired onboarding request was activated.'
);

echo "[PASS] Teacher onboarding code rotation, request token security, rate limiting, approval/reuse, activation, initial SAMS Code, rejection, expiry, audit ownership, and tenant isolation verified." . PHP_EOL;
