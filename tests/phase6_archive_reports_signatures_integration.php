<?php

declare(strict_types=1);

$host = getenv('SAMS_TEST_DB_HOST') ?: '';
$port = (int)(getenv('SAMS_TEST_DB_PORT') ?: 3306);
$db = getenv('SAMS_TEST_DB_NAME') ?: '';
$user = getenv('SAMS_TEST_DB_USER') ?: '';
$pass = getenv('SAMS_TEST_DB_PASS') ?: '';

if ($host === '' || $db === '' || $user === '') {
    fwrite(STDERR, "Missing SAMS_TEST_DB_* environment variables.\n");
    exit(2);
}

function expect_true(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function expect_exception(callable $callback, int $status, string $message): void
{
    try {
        $callback();
    } catch (Throwable $e) {
        $actualStatus = method_exists($e, 'httpStatus')
            ? $e->httpStatus()
            : ($e instanceof InvalidArgumentException ? 422 : null);
        expect_true($actualStatus === $status, $message . ' Wrong status.');
        return;
    }

    throw new RuntimeException($message);
}

function execute_schema(PDO $pdo, string $sql): void
{
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    foreach (preg_split('/;\s*(?:\R|$)/', $sql, -1, PREG_SPLIT_NO_EMPTY) as $statement) {
        if (trim($statement) !== '') $pdo->exec($statement);
    }
}

// RED gate: these are the canonical Phase 6 service boundaries.
require_once __DIR__ . '/../backend/vendor/autoload.php';

$required = [
    'SAMS\\Services\\ArchiveService',
    'SAMS\\Controllers\\ArchiveController',
    'SAMS\\Controllers\\ReportController',
    'SAMS\\Controllers\\SignatureController',
];
foreach ($required as $class) {
    expect_true(class_exists($class), 'Canonical Phase 6 class is missing: ' . $class);
}

expect_true(method_exists(SAMS\Services\ReportService::class, 'monthly'), 'ReportService::monthly is missing.');
expect_true(method_exists(SAMS\Services\SignatureService::class, 'save'), 'SignatureService::save is missing.');
expect_true(method_exists(SAMS\Services\SignatureService::class, 'delete'), 'SignatureService::delete is missing.');

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $host, $port),
    $user,
    $pass,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]
);
$schema = file_get_contents(__DIR__ . '/../database/schema.sql');
if ($schema === false) throw new RuntimeException('Unable to read schema.');
execute_schema($pdo, $schema);

$pdo->exec("INSERT INTO academic_years (name, starts_on, ends_on, is_active)
VALUES ('2026/2027', '2026-09-01', '2027-07-31', 1)");
$pdo->exec("INSERT INTO academic_years (name, starts_on, ends_on, is_active)
VALUES ('2025/2026', '2025-09-01', '2026-07-31', 0)");
$pdo->exec("INSERT INTO users (username, employee_id, full_name, password_hash, role, is_active)
VALUES ('admin.phase6', 'ADM6', 'Phase 6 Admin', 'synthetic-admin-hash', 'admin', 1),
       ('teacher.phase6', 'TCH6', 'Phase 6 Teacher', 'synthetic-teacher-hash', 'teacher', 1),
       ('other.teacher6', 'TCH7', 'Other Teacher', 'synthetic-other-hash', 'teacher', 1),
       ('counselor.phase6', 'CNS6', 'Phase 6 Counselor', 'synthetic-counselor-hash', 'counselor', 1)");

$pdo->exec("INSERT INTO classes (academic_year_id, name, level, branch, is_active)
VALUES (1, 'P6-A', '2BAC', 'SP', 1),
       (1, 'P6-B', '2BAC', 'SP', 1),
       (2, 'P6-HIST', '2BAC', 'SP', 0)");
$pdo->exec('INSERT INTO teacher_classes (teacher_id, class_id) VALUES (2, 1)');
$pdo->exec("INSERT INTO students
    (class_id, student_number, massar_code, birth_date, first_name, last_name, status)
VALUES (1, 'P6-S001', 'P6M001', '2010-01-01', 'Alpha', 'Student', 'active'),
       (1, 'P6-S002', 'P6M002', '2010-02-02', 'Beta', 'Student', 'active')");

$pdo->exec("INSERT INTO student_enrollments (student_id, class_id, starts_on, ends_on)
VALUES (1, 1, '2026-09-01', '2026-09-15'),
       (1, 2, '2026-09-16', NULL),
       (2, 1, '2026-09-01', NULL)");

$pdo->exec("INSERT INTO attendance
    (student_id, enrollment_id, attendance_date, period, status, recorded_by)
VALUES (1, 1, '2026-09-05', 1, 'absent', 2),
       (1, 1, '2026-09-05', 2, 'present', 2),
       (1, 2, '2026-09-20', 1, 'absent', 2),
       (2, 3, '2026-09-10', 1, 'late', 2)");

use SAMS\Services\ArchiveService;
use SAMS\Services\ReportService;
use SAMS\Services\SignatureService;

$archive = new ArchiveService();
$report = new ReportService();
$signature = new SignatureService();

expect_exception(
    static fn() => $archive->read(4, 'counselor', 1, 'days', '2026-09'),
    403,
    'Counselor was allowed to use the admin archive.'
);
expect_exception(
    static fn() => $archive->read(3, 'teacher', 1, 'days', '2026-09'),
    403,
    'Unassigned teacher was allowed to use the admin archive.'
);

$days = $archive->read(1, 'admin', 1, 'days', '2026-09');
expect_true(count($days['days']) === 2, 'Archive days should contain two recorded dates.');
expect_true($days['days'][0]['attendance_date'] === '2026-09-10', 'Archive days should be ordered newest first.');

$month = $archive->read(1, 'admin', 1, 'month', '2026-09');
expect_true(count($month['students']) === 2, 'Archive month should return the two class-1 enrollments.');
expect_true((int)$month['students'][0]['recorded_count'] + (int)$month['students'][1]['recorded_count'] === 3, 'Archive month totals are incorrect.');
expect_true(!array_key_exists('password_hash', $month['students'][0]), 'Archive leaked password_hash.');

$day = $archive->read(1, 'admin', 1, 'day', null, '2026-09-05');
expect_true(count(array_filter($day['records'], static fn(array $row): bool => $row['attendance_id'] !== null)) === 2, 'Archive day missed attendance rows.');

$history = $archive->read(1, 'admin', 1, 'student', null, null, 1);
expect_true(count(array_filter($history['history'], static fn(array $row): bool => $row['attendance_id'] !== null)) === 2, 'Student history mixed in the second enrollment.');

expect_exception(
    static fn() => $archive->read(1, 'admin', 1, 'day', null, '2028-01-01'),
    422,
    'Out-of-year archive date was accepted.'
);
expect_exception(
    static fn() => $archive->read(1, 'admin', 1, 'student', null, null, 999),
    404,
    'Unknown student history was accepted.'
);
expect_exception(
    static fn() => $signature->save(2, 1, 'data:image/png;base64,' . base64_encode('not-a-png')),
    422,
    'Non-PNG signature payload was accepted.'
);

$reportData = $report->monthly(2, 'teacher', 1, '2026-09');
expect_true($reportData['class']['id'] == 1, 'Monthly report returned the wrong class.');
$alpha = null;
foreach ($reportData['students'] as $row) {
    if ((int)$row['id'] === 1) $alpha = $row;
}
expect_true($alpha !== null, 'Monthly report omitted the enrolled student.');
expect_true((int)$alpha['recorded_count'] === 2, 'Monthly report leaked attendance from the later enrollment.');
expect_true((int)$alpha['absent_count'] === 1 && (int)$alpha['present_count'] === 1, 'Monthly report totals are incorrect.');
expect_true((int)$alpha['other_count'] === 0, 'Monthly report other_count is incorrect.');
expect_true(!array_key_exists('password_hash', $alpha), 'Monthly report leaked password_hash.');

expect_exception(
    static fn() => $report->monthly(3, 'teacher', 1, '2026-09'),
    403,
    'Unassigned teacher accessed a class report.'
);

$redPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
$bluePng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYPgPAAEDAQAIicLsAAAAAElFTkSuQmCC';
$png = 'data:image/png;base64,' . $redPng;
$saved = $signature->save(2, 1, $png);
expect_true((int)$saved['id'] > 0, 'Initial signature save failed.');
$firstSignatureId = (int)$saved['id'];

$savedAgain = $signature->save(2, 1, 'data:image/png;base64,' . $bluePng);
expect_true((int)$savedAgain['id'] === $firstSignatureId, 'Signature save created a duplicate row.');

$pdo->exec("CREATE TRIGGER fail_phase6_signature_audit
BEFORE INSERT ON audit_logs
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced Phase 6 signature rollback'");
$rollbackFailed = false;
try {
    $signature->save(2, 1, 'data:image/png;base64,' . $redPng);
} catch (PDOException) {
    $rollbackFailed = true;
} finally {
    $pdo->exec('DROP TRIGGER fail_phase6_signature_audit');
}
expect_true($rollbackFailed, 'Forced signature persistence failure did not surface.');

$stored = $signature->get(2, 1);
expect_true($stored !== null && (int)$stored['id'] === $firstSignatureId, 'Failed signature mutation did not preserve the previous row.');
expect_true($stored['signature_data'] === 'data:image/png;base64,' . $bluePng, 'Failed signature mutation changed stored data.');

expect_true($signature->delete(2, 1) === true, 'Signature delete should report a change.');
expect_true($signature->delete(2, 1) === false, 'Signature delete should be idempotent.');

expect_true(
    (int)$pdo->query("SELECT COUNT(*) FROM audit_logs WHERE action = 'signature.upsert' AND user_id = 2")->fetchColumn() >= 2,
    'Signature save audit coverage is missing.'
);
expect_true(
    (int)$pdo->query("SELECT COUNT(*) FROM audit_logs WHERE action = 'signature.delete' AND user_id = 2")->fetchColumn() === 1,
    'Signature delete audit coverage is missing.'
);

$historyClass = $archive->read(1, 'admin', 3, 'days', '2026-09');
expect_true(isset($historyClass['class']) && (int)$historyClass['class']['is_active'] === 0, 'Historical inactive class could not be read.');

echo "Phase 6 archive/report/signature integration: PASS\n";
