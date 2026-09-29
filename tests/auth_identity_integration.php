<?php

declare(strict_types=1);

require_once __DIR__ . '/../backend/vendor/autoload.php';

use SAMS\Helpers\Database;
use SAMS\Helpers\Security;
use SAMS\Services\AuthService;
use SAMS\Services\LoginCodeService;
use SAMS\Repositories\UserRepository;

function auth_assert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function auth_expect_failure(callable $callback, string $message): void
{
    try {
        $callback();
    } catch (Throwable $e) {
        auth_assert($e instanceof InvalidArgumentException || $e instanceof RuntimeException, $message);
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
$pdo->exec("INSERT INTO schools (code, name, status) VALUES ('AUTH-TEST', 'Auth Test School', 'active')");
$schoolId = (int)$pdo->lastInsertId();

$users = new UserRepository();
$adminId = $users->create('auth-admin', 'Auth Admin', Security::hashPassword('AdminPassword123!'), 'admin', null, null, $schoolId);
$teacherId = $users->create('auth-teacher', 'Auth Teacher', Security::hashPassword('TeacherPassword123!'), 'teacher', 'T-AUTH', null, $schoolId);

$loginCodes = new LoginCodeService();
$issued = $loginCodes->issueForUser($adminId, $teacherId, $schoolId);
$code = $issued['sams_code'];

auth_assert(preg_match('/^T[0-9]{6}$/', $code) === 1, 'Issued SAMS Code format is invalid.');
auth_assert((string)$issued['school_id'] === (string)$schoolId, 'Issued SAMS Code returned the wrong school.');
auth_assert((int)$issued['user_id'] === $teacherId, 'Issued SAMS Code returned the wrong user.');
auth_assert((int)$pdo->query("SELECT COUNT(*) FROM sams_login_codes WHERE user_id = {$teacherId} AND revoked_at IS NULL")->fetchColumn() === 1, 'Exactly one active SAMS Code should exist.');
auth_assert($pdo->query("SELECT code_hash FROM sams_login_codes WHERE user_id = {$teacherId} ORDER BY id DESC LIMIT 1")->fetchColumn() === LoginCodeService::hashCode($code), 'Stored login code hash does not match the issued code.');
auth_assert((int)$pdo->query("SELECT COUNT(*) FROM sams_login_codes WHERE user_id = {$teacherId} AND code_hash = " . $pdo->quote($code))->fetchColumn() === 0, 'Plaintext SAMS Code was stored.');

$auth = new AuthService();
$authenticated = $auth->authenticateBySamsCode($code, 'TeacherPassword123!');
auth_assert((int)$authenticated['id'] === $teacherId, 'SAMS Code login returned the wrong user.');
auth_assert((int)$authenticated['school_id'] === $schoolId, 'SAMS Code login returned the wrong school.');
auth_assert($authenticated['role'] === 'teacher', 'SAMS Code login returned the wrong role.');

auth_expect_failure(
    static fn() => $auth->authenticateBySamsCode($code, 'WrongPassword123!'),
    'Invalid password was accepted for a valid SAMS Code.'
);

$beforeReissueVersion = (int)$pdo->query("SELECT session_version FROM users WHERE id = {$teacherId}")->fetchColumn();
$reissued = $loginCodes->issueForUser($adminId, $teacherId, $schoolId);
$oldActive = (int)$pdo->query("SELECT COUNT(*) FROM sams_login_codes WHERE user_id = {$teacherId} AND revoked_at IS NULL")->fetchColumn();
$oldCode = $code;
auth_assert($oldActive === 1, 'Reissue should leave exactly one active code.');
auth_assert($reissued['sams_code'] !== $oldCode, 'Reissue generated the same SAMS Code.');
auth_assert($reissued['session_version'] === $beforeReissueVersion + 1, 'SAMS Code reissue did not invalidate sessions.');
auth_assert((int)$pdo->query("SELECT COUNT(*) FROM sams_login_codes WHERE user_id = {$teacherId} AND revoked_at IS NOT NULL")->fetchColumn() === 1, 'Old SAMS Code was not revoked.');

auth_expect_failure(
    static fn() => $auth->authenticateBySamsCode($oldCode, 'TeacherPassword123!'),
    'Revoked SAMS Code was accepted.'
);
$authenticatedAgain = $auth->authenticateBySamsCode($reissued['sams_code'], 'TeacherPassword123!');
auth_assert((int)$authenticatedAgain['id'] === $teacherId, 'Reissued SAMS Code cannot authenticate the same user.');

$users->updateProfile($teacherId, 'Auth Teacher', 'teacher', false, 'T-AUTH', 'T-AUTH', null, $schoolId);
auth_expect_failure(
    static fn() => $loginCodes->issueForUser($adminId, $teacherId, $schoolId),
    'Deactivated account received a SAMS Code.'
);
auth_expect_failure(
    static fn() => $auth->authenticateBySamsCode($reissued['sams_code'], 'TeacherPassword123!'),
    'Deactivated account authenticated with a previously issued SAMS Code.'
);

echo "[PASS] SAMS Code issuance, hashing, rotation, login, session invalidation, and lifecycle checks verified." . PHP_EOL;
