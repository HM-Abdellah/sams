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

function expect_throw(callable $callback, string $label): void
{
    try {
        $callback();
    } catch (Throwable) {
        return;
    }
    throw new RuntimeException($label);
}

function execute_schema(PDO $pdo, string $sql): void
{
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    foreach (preg_split('/;\s*(?:\R|$)/', $sql, -1, PREG_SPLIT_NO_EMPTY) as $statement) {
        if (trim($statement) !== '') $pdo->exec($statement);
    }
}
$pdo = new PDO(
    sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $host, $port),
    $user,
    $pass,
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]
);

$schema = file_get_contents(__DIR__ . '/../database/schema.sql');
if ($schema === false) throw new RuntimeException('Unable to read schema.');
execute_schema($pdo, $schema);
require_once __DIR__ . '/../backend/vendor/autoload.php';

$pdo->exec("INSERT INTO schools (code, name) VALUES ('ATTENDANCE', 'Attendance Test School')");
$pdo->exec("INSERT INTO academic_years (school_id, name, starts_on, ends_on, is_active) VALUES (1, '2026-2027', '2026-09-01', '2027-07-31', 1)");
$pdo->exec("INSERT INTO users (school_id, username, full_name, password_hash, role) VALUES (1, 'admin', 'Integration Admin', 'x', 'admin')");
$pdo->exec("INSERT INTO users (school_id, username, full_name, password_hash, role) VALUES (1, 'teacher', 'Integration Teacher', 'x', 'teacher')");
$pdo->exec("INSERT INTO users (school_id, username, full_name, password_hash, role) VALUES (1, 'other', 'Other Teacher', 'x', 'teacher')");
$pdo->exec("INSERT INTO classes (academic_year_id, name, level, branch) VALUES (1, '2BAC-A', '2BAC', 'SP')");
$pdo->exec("INSERT INTO classes (academic_year_id, name, level, branch) VALUES (1, '2BAC-B', '2BAC', 'SP')");
$pdo->exec("INSERT INTO teacher_classes (teacher_id, class_id) VALUES (2, 1)");

$pdo->exec("INSERT INTO students
    (class_id, student_number, massar_code, birth_date, first_name, last_name)
    VALUES
    (1, 'S001', 'M001', '2010-01-02', 'A', 'Alpha'),
    (1, 'S002', 'M002', '2010-02-03', 'B', 'Beta'),
    (1, 'S003', 'M003', '2010-03-04', 'C', 'Inactive'),
    (2, 'S004', 'M004', '2010-04-05', 'D', 'Other')");
$pdo->exec("UPDATE students SET status = 'inactive' WHERE id = 3");
$pdo->exec("INSERT INTO student_enrollments
    (student_id, class_id, starts_on)
    VALUES
    (1, 1, '2026-09-01'),
    (2, 1, '2026-09-01'),
    (3, 1, '2026-09-01'),
    (4, 2, '2026-09-01')");

use SAMS\Services\TeacherAttendanceService;

$service = new TeacherAttendanceService();

$week = $service->weeklyRegister(2, 'teacher', 1, '2026-09-23');
expect_true($week['week_start'] === '2026-09-21', 'Week must normalize to Monday.');
expect_true($week['week_end'] === '2026-09-26', 'School week must span six days.');
expect_true(count($week['students']) === 2, 'Only active students should be returned.');
expect_true(
    $week['students'][0]['first_name'] !== ''
    && !array_key_exists('massar_code', $week['students'][0]),
    'Attendance roster must not expose Massar codes.'
);
expect_true($week['attendance'] === [], 'Fresh attendance register must be empty.');

$partialWeek = $service->weeklyRegister(2, 'teacher', 1, '2026-09-02');
expect_true($partialWeek['week_start'] === '2026-09-01', 'Partially overlapping week must clamp to academic-year start.');
expect_true($partialWeek['week_end'] === '2026-09-05', 'Clamped week must preserve its in-year end date.');

expect_throw(
    static fn() => $service->weeklyRegister(3, 'teacher', 1, '2026-09-23'),
    'Teacher without class assignment was allowed to read attendance.'
);
expect_throw(
    static fn() => $service->weeklyRegister(2, 'teacher', 2, '2026-09-23'),
    'Teacher was allowed to read another teacher class.'
);
$saved = $service->saveBulk(2, 'teacher', 1, [
    ['student_id' => 1, 'attendance_date' => '2026-09-23', 'period' => 1, 'action' => 'upsert', 'status' => 'absent', 'expected_revision' => 0],
    ['student_id' => 2, 'attendance_date' => '2026-09-23', 'period' => 2, 'action' => 'upsert', 'status' => 'late', 'expected_revision' => 0],
    ['student_id' => 2, 'attendance_date' => '2026-09-23', 'period' => 3, 'action' => 'delete', 'expected_revision' => 0],
], 1);
expect_true($saved['changed'] === 2, 'Bulk save should report two changed rows.');
expect_true($saved['unchanged'] === 1, 'Deleting a missing row should be a no-op.');
expect_true((int)$pdo->query('SELECT COUNT(*) FROM attendance')->fetchColumn() === 2, 'Bulk save did not persist expected rows.');

$pdo->exec("INSERT INTO attendance_week_signatures
    (class_id, teacher_id, week_start, signature_data)
    VALUES (1, 2, '2026-09-21', 'test')");
$pdo->exec("INSERT INTO attendance_week_submissions
    (class_id, week_start, received_by)
    VALUES (1, '2026-09-21', 1)");

$revised = $service->saveBulk(2, 'teacher', 1, [
    ['student_id' => 1, 'attendance_date' => '2026-09-23', 'period' => 1, 'action' => 'upsert', 'status' => 'late', 'expected_revision' => 1],
], 1);
expect_true($revised['changed'] === 1, 'Changed attendance should be persisted.');
$signatureStatus = (string)$pdo->query("SELECT status FROM attendance_week_signatures WHERE class_id = 1 AND teacher_id = 2 AND week_start = '2026-09-21'")->fetchColumn();
expect_true($signatureStatus === 'needs_resign', 'Weekly signature was not invalidated after attendance correction.');
expect_true((int)$pdo->query("SELECT COUNT(*) FROM attendance_week_submissions WHERE class_id = 1 AND week_start = '2026-09-21'")->fetchColumn() === 0, 'Weekly administration submission was not cleared after attendance correction.');

$noop = $service->saveBulk(2, 'teacher', 1, [
    ['student_id' => 1, 'attendance_date' => '2026-09-23', 'period' => 1, 'action' => 'upsert', 'status' => 'late', 'expected_revision' => 1],
], 1);
expect_true($noop['changed'] === 0 && $noop['unchanged'] === 1, 'Exact no-op must not report a change.');

expect_throw(
    static fn() => $service->saveBulk(2, 'teacher', 1, [
        ['student_id' => 1, 'attendance_date' => '2026-09-23', 'period' => 4, 'action' => 'upsert', 'status' => 'absent', 'expected_revision' => 0],
        ['student_id' => 1, 'attendance_date' => '2026-09-23', 'period' => 4, 'action' => 'upsert', 'status' => 'late', 'expected_revision' => 0],
    ], 1),
    'Duplicate attendance keys inside one batch were accepted.'
);

expect_throw(
    static fn() => $service->saveBulk(2, 'teacher', 1, [
        ['student_id' => 4, 'attendance_date' => '2026-09-23', 'period' => 4, 'action' => 'upsert', 'status' => 'absent', 'expected_revision' => 0]
    ], 1),
    'Attendance for another class was accepted.'
);

expect_throw(
    static fn() => $service->saveBulk(2, 'teacher', 1, [
        ['student_id' => 1, 'attendance_date' => '2028-01-01', 'period' => 4, 'action' => 'upsert', 'status' => 'absent', 'expected_revision' => 0]
    ], 1),
    'Attendance outside the academic year was accepted.'
);

$pdo->exec("INSERT INTO attendance_signoffs
    (class_id, teacher_id, attendance_date, period, signature_data)
    VALUES (1, 2, '2026-09-23', 5, 'test')");

expect_throw(
    static fn() => $service->saveBulk(2, 'teacher', 1, [
        ['student_id' => 1, 'attendance_date' => '2026-09-23', 'period' => 5, 'action' => 'upsert', 'status' => 'absent', 'expected_revision' => 0]
    ], 1),
    'Signed lesson was editable without reopening.'
);
$pdo->exec('DELETE FROM attendance_signoffs');
$pdo->exec("CREATE TRIGGER fail_attendance_audit AFTER INSERT ON audit_logs FOR EACH ROW
BEGIN
  IF NEW.action = 'attendance.upsert' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced attendance test failure';
  END IF;
END");

$beforeRollback = (int)$pdo->query('SELECT COUNT(*) FROM attendance')->fetchColumn();

expect_throw(
    static fn() => $service->saveBulk(2, 'teacher', 1, [
        ['student_id' => 1, 'attendance_date' => '2026-09-24', 'period' => 1, 'action' => 'upsert', 'status' => 'absent', 'expected_revision' => 0],
        ['student_id' => 2, 'attendance_date' => '2026-09-24', 'period' => 2, 'action' => 'upsert', 'status' => 'late', 'expected_revision' => 0],
    ], 1),
    'Forced failure did not abort the attendance transaction.'
);

$afterRollback = (int)$pdo->query('SELECT COUNT(*) FROM attendance')->fetchColumn();
expect_true($beforeRollback === $afterRollback, 'Failed attendance batch was not rolled back completely.');
$pdo->exec('DROP TRIGGER fail_attendance_audit');

$recovered = $service->saveBulk(2, 'teacher', 1, [
    ['student_id' => 1, 'attendance_date' => '2026-09-24', 'period' => 1, 'action' => 'upsert', 'status' => 'absent', 'expected_revision' => 0],
    ['student_id' => 2, 'attendance_date' => '2026-09-24', 'period' => 2, 'action' => 'upsert', 'status' => 'late', 'expected_revision' => 0],
], 1);
expect_true($recovered['changed'] === 2, 'Attendance batch did not recover after rollback.');

echo "[PASS] Phase 4 attendance workflow integration\n";
echo "[PASS] weekly register, authorization, bulk save, no-op, conflict, signed-lock, rollback, and recovery verified\n";
