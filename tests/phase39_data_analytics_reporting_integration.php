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

function execute_schema(PDO $pdo, string $sql): void
{
    $targetDatabase = trim((string)(getenv('SAMS_TEST_DB_NAME') ?: ''));
    if (!preg_match('/^sams_test_[A-Za-z0-9_]+$/', $targetDatabase)) {
        throw new RuntimeException('Refusing unsafe integration-test schema target.');
    }
    $replacementCount = 0;
    $isolatedSchema = preg_replace(
        '/CREATE DATABASE IF NOT EXISTS sams\\s+CHARACTER SET utf8mb4\\s+COLLATE utf8mb4_unicode_ci;\\s*USE sams;\\s*/i',
        'USE ' . $targetDatabase . ';',
        $sql,
        1,
        $replacementCount
    );
    if ($isolatedSchema === null || $replacementCount !== 1 || preg_match('/\\bUSE\\s+sams\\s*;/i', $isolatedSchema) === 1) {
        throw new RuntimeException('Refusing to execute an unisolated production schema selector.');
    }
    $sql = $isolatedSchema;
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

use SAMS\Services\AdminDashboardService;
use SAMS\Services\ArchiveService;
use SAMS\Services\ReportService;

$today = (string)$pdo->query('SELECT CURDATE()')->fetchColumn();

$pdo->exec("INSERT INTO schools (code, name) VALUES ('PH39', 'Phase 39 Metrics School')");
$schoolId = (int)$pdo->lastInsertId();
$pdo->exec("INSERT INTO academic_years (school_id, name, starts_on, ends_on, is_active)
    VALUES ({$schoolId}, '2026-2027', '2026-09-01', '2027-07-31', 1)");
$yearId = (int)$pdo->lastInsertId();
$pdo->exec("INSERT INTO users (school_id, username, employee_id, full_name, password_hash, role, is_active)
    VALUES ({$schoolId}, 'phase39.admin', 'P39A', 'Phase 39 Admin', 'hash-admin', 'admin', 1),
           ({$schoolId}, 'phase39.teacher', 'P39T', 'Phase 39 Teacher', 'hash-teacher', 'teacher', 1)");
$adminId = (int)$pdo->query("SELECT id FROM users WHERE username = 'phase39.admin'")->fetchColumn();
$teacherId = (int)$pdo->query("SELECT id FROM users WHERE username = 'phase39.teacher'")->fetchColumn();

$pdo->exec("INSERT INTO classes (academic_year_id, name, level, branch, is_active)
    VALUES ({$yearId}, 'P39-A', '2BAC', 'SP', 1)");
$classId = (int)$pdo->lastInsertId();
$pdo->exec("INSERT INTO teacher_classes (teacher_id, class_id) VALUES ({$teacherId}, {$classId})");

$pdo->exec("INSERT INTO students (class_id, student_number, first_name, last_name, status)
    VALUES ({$classId}, 'P39-S1', 'Alpha', 'Student', 'active'),
           ({$classId}, 'P39-S2', 'Beta', 'Student', 'active')");
$student1 = (int)$pdo->query("SELECT id FROM students WHERE student_number = 'P39-S1'")->fetchColumn();
$student2 = (int)$pdo->query("SELECT id FROM students WHERE student_number = 'P39-S2'")->fetchColumn();
$pdo->exec("INSERT INTO student_enrollments (student_id, class_id, starts_on)
    VALUES ({$student1}, {$classId}, '2026-09-01'), ({$student2}, {$classId}, '2026-09-01')");
$enrollment1 = (int)$pdo->query("SELECT id FROM student_enrollments WHERE student_id = {$student1} AND class_id = {$classId}")->fetchColumn();
$enrollment2 = (int)$pdo->query("SELECT id FROM student_enrollments WHERE student_id = {$student2} AND class_id = {$classId}")->fetchColumn();

$rows = [
    [$student1, $enrollment1, 1, 'present'],
    [$student1, $enrollment1, 2, 'absent'],
    [$student1, $enrollment1, 3, 'late'],
    [$student2, $enrollment2, 1, 'present'],
    [$student2, $enrollment2, 2, 'excused'],
    [$student2, $enrollment2, 3, 'present'],
];
foreach ($rows as [$studentId, $enrollmentId, $period, $status]) {
    $stmt = $pdo->prepare('INSERT INTO attendance (student_id, enrollment_id, attendance_date, period, status, recorded_by) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([$studentId, $enrollmentId, $today, $period, $status, $teacherId]);
}

$dashboard = (new AdminDashboardService())->snapshot($schoolId);
expect_true($dashboard['summary']['today_records'] === 6, 'Dashboard recorded-entry count is incorrect.');
expect_true((float)$dashboard['summary']['today_presence_rate'] === 50.0, 'Dashboard presence rate is inconsistent.');
expect_true((float)$dashboard['class_stats'][0]['presence_rate'] === 50.0, 'Dashboard class presence rate is inconsistent.');
expect_true((float)$dashboard['attendance_trend'][13]['presence_rate'] === 50.0, 'Dashboard trend presence rate is inconsistent.');

$report = (new ReportService())->monthly($teacherId, 'teacher', $classId, substr($today, 0, 7), $schoolId);
expect_true($report['summary']['recorded_count'] === 6, 'Report recorded-entry summary is incorrect.');
expect_true((float)$report['summary']['presence_rate'] === 50.0, 'Report summary presence rate is inconsistent.');
$reportByStudent = [];
foreach ($report['students'] as $student) {
    $reportByStudent[(int)$student['id']] = $student;
}
expect_true(isset($reportByStudent[$student1]), 'Report first student is missing.');
expect_true(isset($reportByStudent[$student2]), 'Report second student is missing.');
expect_true((float)$reportByStudent[$student1]['presence_rate'] === 33.3, 'Report first student rate is inconsistent.');
expect_true((float)$reportByStudent[$student2]['presence_rate'] === 66.7, 'Report second student rate is inconsistent.');

$archive = (new ArchiveService())->read($adminId, 'admin', $classId, 'month', substr($today, 0, 7), null, null, $schoolId);
expect_true($archive['summary']['recorded_count'] === 6, 'Archive recorded-entry summary is incorrect.');
expect_true((float)$archive['summary']['presence_rate'] === 50.0, 'Archive summary presence rate is inconsistent.');

$archiveDays = (new ArchiveService())->read($adminId, 'admin', $classId, 'days', substr($today, 0, 7), null, null, $schoolId);
expect_true((float)$archiveDays['days'][0]['presence_rate'] === 50.0, 'Archive day presence rate is inconsistent.');

$emptyClassIdStmt = $pdo->prepare("INSERT INTO classes (academic_year_id, name, level, branch, is_active) VALUES (?, 'P39-EMPTY', '2BAC', 'SP', 1)");
$emptyClassIdStmt->execute([$yearId]);
$emptyClassId = (int)$pdo->lastInsertId();
$emptyDashboard = (new AdminDashboardService())->snapshot($schoolId);
$emptyClass = array_values(array_filter($emptyDashboard['class_stats'], static fn(array $row): bool => (int)$row['id'] === $emptyClassId))[0] ?? null;
expect_true($emptyClass !== null && $emptyClass['presence_rate'] === null, 'Unrecorded class rate must remain null.');

// Regression: a future active academic year has a roster even before its first day.
// Dashboard headcount must agree with Admin Classes without using CURDATE() as
// the boundary for enrollment membership in that academic year.
$futureYearStmt = $pdo->prepare(
    "INSERT INTO academic_years (school_id, name, starts_on, ends_on, is_active)
     VALUES (?, '2027-2028', '2027-09-01', '2028-07-31', 0)"
);
$futureYearStmt->execute([$schoolId]);
$futureYearId = (int)$pdo->lastInsertId();

$futureClassStmt = $pdo->prepare(
    "INSERT INTO classes (academic_year_id, name, level, branch, is_active)
     VALUES (?, 'P39-FUTURE', '2BAC', 'SP', 1)"
);
$futureClassStmt->execute([$futureYearId]);
$futureClassId = (int)$pdo->lastInsertId();

$futureStudentStmt = $pdo->prepare(
    "INSERT INTO students (class_id, student_number, first_name, last_name, status)
     VALUES (?, 'P39-FUTURE-S1', 'Future', 'Student', 'active')"
);
$futureStudentStmt->execute([$futureClassId]);
$futureStudentId = (int)$pdo->lastInsertId();

$futureEnrollmentStmt = $pdo->prepare(
    'INSERT INTO student_enrollments (student_id, class_id, starts_on) VALUES (?, ?, ?)'
);
$futureEnrollmentStmt->execute([$futureStudentId, $futureClassId, '2027-09-01']);

$pdo->exec("UPDATE academic_years SET is_active = 0 WHERE school_id = {$schoolId}");
$pdo->exec("UPDATE academic_years SET is_active = 1 WHERE id = {$futureYearId} AND school_id = {$schoolId}");

$futureDashboard = (new AdminDashboardService())->snapshot($schoolId);
$futureClassStats = array_values(array_filter(
    $futureDashboard['class_stats'],
    static fn(array $row): bool => (int)$row['id'] === $futureClassId
))[0] ?? null;

expect_true(
    (int)$futureDashboard['summary']['active_students'] === 1,
    'Dashboard active student summary must count future-year roster enrollments.'
);
expect_true(
    $futureClassStats !== null && (int)$futureClassStats['student_count'] === 1,
    'Dashboard class statistics must match the future-year class roster.'
);
expect_true(
    $futureClassStats !== null && (int)$futureClassStats['today_records'] === 0,
    'Future-year roster must not invent attendance records for today.'
);

echo "[PASS] Phase 39 data/analytics/reporting integration\n";
echo "[PASS] dashboard, trend, teacher report, archive, and academic-year roster semantics verified\n";
