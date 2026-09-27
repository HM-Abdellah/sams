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

function expect_throw(callable $callback, string $message): void
{
    try {
        $callback();
    } catch (Throwable) {
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

$serviceClasses = [
    'SAMS\Services\AcademicYearAdministrationService',
    'SAMS\Services\ClassAdministrationService',
    'SAMS\Services\UserAdministrationService',
    'SAMS\Services\TeacherAdministrationService',
    'SAMS\Services\TeacherClassAdministrationService',
    'SAMS\Services\AdminDashboardService',
    'SAMS\Services\AuditAdministrationService',
];

foreach ($serviceClasses as $serviceClass) {
    expect_true(
        class_exists($serviceClass),
        'Canonical administration service is not implemented: ' . $serviceClass
    );
}
$today = (string)$pdo->query('SELECT CURDATE()')->fetchColumn();

$pdo->exec("INSERT INTO academic_years (name, starts_on, ends_on, is_active)
    VALUES ('2026-2027', '2026-09-01', '2027-07-31', 1)");
$pdo->exec("INSERT INTO academic_years (name, starts_on, ends_on, is_active)
    VALUES ('2025-2026', '2025-09-01', '2026-07-31', 0)");

$pdo->exec("INSERT INTO users (username, employee_id, full_name, password_hash, role, is_active)
    VALUES
    ('admin.one', 'ADM001', 'Admin One', 'hash-admin-1', 'admin', 1),
    ('teacher.one', 'TCH001', 'Teacher One', 'hash-teacher-1', 'teacher', 1),
    ('teacher.two', 'TCH002', 'Teacher Two', 'hash-teacher-2', 'teacher', 1),
    ('counselor.one', 'CNS001', 'Counselor One', 'hash-counselor', 'counselor', 1),
    ('admin.two', 'ADM002', 'Admin Two', 'hash-admin-2', 'admin', 1)");

$pdo->exec("INSERT INTO classes (academic_year_id, name, level, branch, is_active)
    VALUES
    (1, '2BAC SP A', '2BAC', 'SP', 1),
    (1, '2BAC SP B', '2BAC', 'SP', 1),
    (1, '2BAC SP C', '2BAC', 'SP', 0),
    (2, '2BAC OLD', '2BAC', 'SP', 1)");

$pdo->exec("INSERT INTO teacher_classes (teacher_id, class_id) VALUES (2, 1)");
$pdo->exec("INSERT INTO subjects (code, name_fr, name_ar, name_en)
    VALUES ('MATH', 'Mathématiques', 'الرياضيات', 'Mathematics')");

$pdo->exec("INSERT INTO students
    (class_id, student_number, massar_code, birth_date, first_name, last_name, status)
    VALUES (1, 'S001', 'M001', '2010-01-01', 'Student', 'One', 'active')");
$pdo->exec("INSERT INTO student_enrollments (student_id, class_id, starts_on)
    VALUES (1, 1, '2026-09-01')");

for ($period = 1; $period <= 5; ++$period) {
    $pdo->exec("INSERT INTO attendance
        (student_id, enrollment_id, attendance_date, period, status, recorded_by)
        VALUES (1, 1, '{$today}', {$period}, 'absent', 2)");
}

use SAMS\Services\AcademicYearAdministrationService;
use SAMS\Services\AdminDashboardService;
use SAMS\Services\AuditAdministrationService;
use SAMS\Services\ClassAdministrationService;
use SAMS\Services\TeacherAdministrationService;
use SAMS\Services\TeacherClassAdministrationService;
use SAMS\Services\UserAdministrationService;

$academicYears = new AcademicYearAdministrationService();
$classes = new ClassAdministrationService();
$users = new UserAdministrationService();
$teachers = new TeacherAdministrationService();
$teacherClasses = new TeacherClassAdministrationService();
$dashboard = new AdminDashboardService();
$audit = new AuditAdministrationService();
$yearList = $academicYears->list();
expect_true(count($yearList) === 2, 'Academic-year administration list is incomplete.');

expect_throw(
    static fn() => $academicYears->create(
        1,
        '2026-overlap',
        '2026-06-01',
        '2027-01-01',
        false
    ),
    'Overlapping academic year was accepted.'
);

$newYearId = $academicYears->create(
    1,
    '2027-2028',
    '2027-09-01',
    '2028-07-31',
    false
);
expect_true($newYearId > 0, 'New academic year was not created.');

$classList = $classes->list();
expect_true(count($classList) === 4, 'Admin class list must include inactive and historical classes.');

$newClassId = $classes->create(1, '2BAC SP D', '2BAC', 'SP');
expect_true($newClassId > 0, 'Class creation failed.');

expect_throw(
    static fn() => $classes->create(1, '2BAC SP D', '2BAC', 'SP'),
    'Duplicate active-year class was accepted.'
);

$pdo->exec("CREATE TRIGGER fail_admin_class_audit AFTER INSERT ON audit_logs FOR EACH ROW
BEGIN
  IF NEW.action = 'class.create' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced admin rollback';
  END IF;
END");

expect_throw(
    static fn() => $classes->create(1, '2BAC ROLLBACK', '2BAC', 'SP'),
    'Forced administration failure did not abort class creation.'
);
$pdo->exec('DROP TRIGGER fail_admin_class_audit');

expect_true(
    (int)$pdo->query("SELECT COUNT(*) FROM classes WHERE name = '2BAC ROLLBACK'")->fetchColumn() === 0,
    'Failed administration class creation was not rolled back.'
);

$updatedClassId = $classes->update(1, 1, '2BAC SP A+', '2BAC', 'SP');
expect_true($updatedClassId === 1, 'Class update returned the wrong class id.');
expect_true($classes->setActive(1, $newClassId, false) === true, 'Class deactivation did not report a change.');
expect_true($classes->setActive(1, $newClassId, false) === false, 'Class deactivation no-op was not idempotent.');
expect_true($classes->setActive(1, $newClassId, true) === true, 'Class activation failed.');
$adminList = $users->list();
expect_true(count($adminList) === 5, 'Admin user list is incomplete.');
foreach ($adminList as $listedUser) {
    expect_true(!array_key_exists('password_hash', $listedUser), 'Admin user list exposed password hash.');
}

$newTeacherId = $users->create(
    1,
    'teacher.three',
    'Teacher Three',
    'teacher',
    'SecurePassword123!',
    'A-NEW',
    '0611223344'
);
expect_true($newTeacherId > 0, 'Teacher user creation failed.');

$beforeResetVersion = (int)$pdo->query(
    "SELECT session_version FROM users WHERE id = {$newTeacherId}"
)->fetchColumn();

$users->resetPassword(1, $newTeacherId, 'NewSecurePassword123!');
$users->unlock(1, $newTeacherId);

$afterResetVersion = (int)$pdo->query(
    "SELECT session_version FROM users WHERE id = {$newTeacherId}"
)->fetchColumn();
expect_true($afterResetVersion === $beforeResetVersion + 2, 'Password reset/unlock did not advance session version.');

$users->update(1, $newTeacherId, 'Teacher Three Updated', 'teacher', true, 'A-NEW', '0611334455');
expect_true(
    (string)$pdo->query("SELECT full_name FROM users WHERE id = {$newTeacherId}")->fetchColumn()
        === 'Teacher Three Updated',
    'User profile update failed.'
);

expect_throw(
    static fn() => $users->create(
        1,
        'teacher.one',
        'Duplicate Username',
        'teacher',
        'DUP001',
        null,
        null
    ),
    'Duplicate username was accepted.'
);

expect_throw(
    static fn() => $users->update(1, 1, 'Admin One', 'admin', false, 'ADM001', null),
    'Administrator was allowed to deactivate their own account.'
);

$users->update(1, 5, 'Admin Two', 'admin', false, 'ADM002', null);

expect_throw(
    static fn() => $users->update(1, 1, 'Admin One', 'admin', false, 'ADM001', null),
    'Last active administrator was allowed to be deactivated.'
);
$teacherList = $teachers->list();
expect_true(count($teacherList['teachers']) === 3, 'Teacher directory should contain three active/inactive teachers.');
expect_true(count($teacherList['subjects']) === 1, 'Initial subject list is incorrect.');
expect_true(!array_key_exists('password_hash', $teacherList['teachers'][0]), 'Teacher directory exposed password hash.');

$subjectId = $teachers->createSubject(
    1,
    'PHY',
    'Physique',
    'الفيزياء',
    'Physics'
);
expect_true($subjectId > 0, 'Subject creation failed.');

expect_throw(
    static fn() => $teachers->createSubject(
        1,
        'PHY',
        'Duplicate',
        'مكرر',
        'Duplicate'
    ),
    'Duplicate subject code was accepted.'
);

$teachers->updateSubject(
    1,
    $subjectId,
    'PHYS',
    'Physique',
    'الفيزياء',
    'Physics',
    true
);

$teachingId = $teachers->assignTeaching(1, 2, $subjectId, 1);
expect_true($teachingId > 0, 'Teaching assignment failed.');

expect_true(
    (int)$pdo->query("SELECT COUNT(*) FROM teacher_classes WHERE teacher_id = 2 AND class_id = 1")->fetchColumn() === 1,
    'Teaching assignment did not preserve class-level teacher access.'
);

expect_throw(
    static fn() => $teachers->assignTeaching(1, 2, $subjectId, 1),
    'Duplicate teaching assignment was accepted.'
);

expect_true($teachers->unassignTeaching(1, $teachingId) === true, 'Teaching unassignment failed.');
$assignmentChanged = $teacherClasses->assign(1, 3, 2);
expect_true($assignmentChanged === true, 'Teacher-class assignment failed.');

expect_true(
    count($teacherClasses->forClass(2)) === 1,
    'Class teacher assignment list is incorrect.'
);
expect_true(
    count($teacherClasses->forTeacher(3)) === 1,
    'Teacher class assignment list is incorrect.'
);

expect_true(
    $teacherClasses->assign(1, 3, 2) === false,
    'Duplicate teacher-class assignment was not idempotent.'
);

expect_true(
    $teacherClasses->unassign(1, 3, 2) === true,
    'Teacher-class unassignment failed.'
);

expect_true(
    $teacherClasses->unassign(1, 3, 2) === false,
    'Teacher-class unassignment no-op was not idempotent.'
);

$dashboardData = $dashboard->snapshot();
expect_true(($dashboardData['summary']['active_classes'] ?? 0) >= 2, 'Dashboard active class summary is incorrect.');
expect_true(($dashboardData['summary']['active_students'] ?? 0) === 1, 'Dashboard active student summary is incorrect.');
expect_true(count($dashboardData['attention_students']) === 1, 'Dashboard absence attention list is incorrect.');
expect_true(
    (int)$dashboardData['attention_students'][0]['absent_count'] === 5,
    'Dashboard absence threshold result is incorrect.'
);

foreach ($dashboardData['attention_students'] as $student) {
    expect_true(!array_key_exists('massar_code', $student), 'Dashboard exposed Massar code.');
}

$auditData = $audit->search(
    1,
    null,
    null,
    null,
    null,
    1,
    100
);
expect_true(($auditData['total'] ?? 0) > 0, 'Audit administration did not record mutations.');
expect_true(
    isset($auditData['items'][0]['action']),
    'Audit search result shape is invalid.'
);
$academicYears->activate(1, $newYearId);

$activeYearCount = (int)$pdo->query(
    'SELECT COUNT(*) FROM academic_years WHERE is_active = 1'
)->fetchColumn();
expect_true($activeYearCount === 1, 'Academic-year activation left more than one active year.');

echo "[PASS] Phase 5 administration backend integration\n";
echo "[PASS] academic years, classes, users, teachers, assignments, dashboard, and audit verified\n";