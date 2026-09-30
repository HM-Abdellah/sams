<?php

declare(strict_types=1);

$host = getenv('SAMS_TEST_DB_HOST') ?: '';
$port = (int)(getenv('SAMS_TEST_DB_PORT') ?: 3306);
$db = getenv('SAMS_TEST_DB_NAME') ?: '';
$user = getenv('SAMS_TEST_DB_USER') ?: '';
$pass = getenv('SAMS_TEST_DB_PASS') ?: '';

if ($host === '' || $db === '' || $user === '') {
    throw new RuntimeException('Missing SAMS_TEST_DB_* environment variables.');
}

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $db),
    $user,
    $pass,
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]
);

function tenant_assert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function tenant_expect_scope_required(callable $callback, string $message): void
{
    try {
        $callback();
    } catch (InvalidArgumentException $e) {
        if ($e->getMessage() === 'Authenticated school scope is required.') {
            return;
        }

        throw $e;
    }

    throw new RuntimeException($message);
}

function tenant_exec_schema(PDO $pdo, string $sql): void
{
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    $statements = preg_split('/;\s*(?:\R|$)/', $sql, -1, PREG_SPLIT_NO_EMPTY);
    foreach ($statements as $statement) {
        if (trim($statement) !== '') $pdo->exec($statement);
    }
}

$schema = file_get_contents(__DIR__ . '/../database/schema.sql');
tenant_assert($schema !== false, 'Unable to read schema.');
tenant_exec_schema($pdo, $schema);
$pdo->exec('USE ' . $db);

$tenantColumns = $pdo->prepare(
    'SELECT table_name, column_name, is_nullable
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND ((table_name = \'users\' AND column_name = \'school_id\')
         OR (table_name = \'academic_years\' AND column_name = \'school_id\'))
     ORDER BY table_name'
);
$tenantColumns->execute();
$tenantNullability = [];
foreach ($tenantColumns->fetchAll() as $column) {
    $tenantNullability[(string)$column['table_name']] = (string)$column['is_nullable'];
}
tenant_assert(($tenantNullability['users'] ?? '') === 'NO', 'Fresh schema must require users.school_id.');
tenant_assert(($tenantNullability['academic_years'] ?? '') === 'NO', 'Fresh schema must require academic_years.school_id.');

$pdo->exec("INSERT INTO schools (code, name) VALUES ('TEN-A', 'Tenant A'), ('TEN-B', 'Tenant B')");
$schoolIds = $pdo->query(
    "SELECT code, id FROM schools WHERE code IN ('TEN-A', 'TEN-B')"
)->fetchAll(PDO::FETCH_KEY_PAIR);
$schoolA = (int)$schoolIds['TEN-A'];
$schoolB = (int)$schoolIds['TEN-B'];

$yearStmt = $pdo->prepare(
    'INSERT INTO academic_years (school_id, name, starts_on, ends_on, is_active)
     VALUES (?, ?, ?, ?, 1)'
);
$yearStmt->execute([$schoolA, '2026/2027', '2026-09-01', '2027-07-31']);
$yearA = (int)$pdo->lastInsertId();
$yearStmt->execute([$schoolB, '2026/2027', '2026-09-01', '2027-07-31']);
$yearB = (int)$pdo->lastInsertId();

$userStmt = $pdo->prepare(
    "INSERT INTO users (school_id, username, full_name, password_hash, role, account_status, is_active)
     VALUES (?, ?, ?, 'hash', ?, 'active', 1)"
);
$userStmt->execute([$schoolA, 'tenant-a-admin', 'Tenant A Admin', 'admin']);
$adminA = (int)$pdo->lastInsertId();
$userStmt->execute([$schoolB, 'tenant-b-admin', 'Tenant B Admin', 'admin']);
$adminB = (int)$pdo->lastInsertId();
$userStmt->execute([$schoolA, 'tenant-a-teacher', 'Tenant A Teacher', 'teacher']);
$teacherA = (int)$pdo->lastInsertId();

$classStmt = $pdo->prepare(
    'INSERT INTO classes (academic_year_id, name, level, branch)
     VALUES (?, ?, ?, ?)'
);
$classStmt->execute([$yearA, 'TEN-A-CLASS', '2BAC', 'SP']);
$classA = (int)$pdo->lastInsertId();
$classStmt->execute([$yearB, 'TEN-B-CLASS', '2BAC', 'SP']);
$classB = (int)$pdo->lastInsertId();

$pdo->prepare(
    'INSERT INTO teacher_classes (teacher_id, class_id) VALUES (?, ?)'
)->execute([$teacherA, $classB]);

$subjectStmt = $pdo->prepare(
    'INSERT INTO subjects (code, name_fr, name_ar, name_en) VALUES (?, ?, ?, ?)'
);
$subjectStmt->execute(['TEN-MATH', 'Tenant Math', 'رياضيات', 'Tenant Math']);
$subjectId = (int)$pdo->lastInsertId();

$pdo->prepare(
    'INSERT INTO teacher_teachings (teacher_id, subject_id, class_id) VALUES (?, ?, ?)'
)->execute([$teacherA, $subjectId, $classB]);

require_once __DIR__ . '/../backend/vendor/autoload.php';

use SAMS\Repositories\AcademicYearRepository;
use SAMS\Repositories\ClassRepository;
use SAMS\Repositories\AdminDashboardRepository;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\TeacherRepository;
use SAMS\Repositories\UserRepository;
use SAMS\Repositories\SchoolImportRepository;
use SAMS\Repositories\SignatureRepository;

$academicYears = new AcademicYearRepository();
$classes = new ClassRepository();
$users = new UserRepository();
$teachers = new TeacherRepository();
$dashboard = new AdminDashboardRepository();
$allYears = $academicYears->all($schoolA);
tenant_assert(count($allYears) === 1, 'School-scoped academic-year list leaked another tenant.');

tenant_assert(
    $academicYears->find($yearB, $schoolA) === null,
    'A school-scoped academic-year lookup returned another tenant.'
);

$adminClasses = $classes->allForAdmin($schoolA);
tenant_assert(count($adminClasses) === 1, 'School-scoped admin class list leaked another tenant.');

$adminUsers = $users->forAdmin($schoolA);
tenant_assert(count($adminUsers) === 2, 'School-scoped user list leaked another tenant.');

$teacherRows = $teachers->all($schoolA);
tenant_assert(count($teacherRows) === 1, 'School-scoped teacher list leaked another tenant.');

$teachingRows = $teachers->teachings($schoolA);
tenant_assert($teachingRows === [], 'Cross-school teaching assignment leaked through teacher read model.');

$dashboardStats = $dashboard->classStats($schoolA);
tenant_assert(
    count($dashboardStats) === 1 && (int)$dashboardStats[0]['id'] === $classA,
    'Admin dashboard class stats leaked another tenant.'
);

$studentStmt = $pdo->prepare(
    'INSERT INTO students (class_id, massar_code, first_name, last_name)
     VALUES (?, ?, ?, ?)'
);
$studentStmt->execute([$classB, 'TEN-B-STUDENT', 'Tenant', 'B Student']);
$studentB = (int)$pdo->lastInsertId();

$studentLookup = (new \SAMS\Repositories\StudentRepository())->studentsByMassarCodes(
    ['TEN-B-STUDENT'],
    $schoolA
);
tenant_assert(
    $studentLookup === [],
    'School-scoped Massar lookup returned another tenant\'s student.'
);

$foreignMassars = (new \SAMS\Repositories\StudentRepository())->massarCodesOwnedByOtherSchools(
    ['TEN-B-STUDENT'],
    $schoolA
);
tenant_assert(
    isset($foreignMassars['ten-b-student']),
    'Cross-school Massar collision was not detected without exposing student details.'
);

$globalLookup = (new \SAMS\Repositories\StudentRepository())->studentsByMassarCodes(['TEN-B-STUDENT']);
tenant_assert(
    count($globalLookup) === 1 && (int)$globalLookup['ten-b-student']['id'] === $studentB,
    'Global compatibility Massar lookup should still resolve the fixture student.'
);

$enrollmentStmt = $pdo->prepare(
    'INSERT INTO student_enrollments (student_id, class_id, starts_on)
     VALUES (?, ?, CURDATE())'
);
$enrollmentStmt->execute([$studentB, $classB]);
$enrollmentB = (int)$pdo->lastInsertId();

$attendanceStmt = $pdo->prepare(
    "INSERT INTO attendance
        (student_id, enrollment_id, attendance_date, period, status, recorded_by)
     VALUES (?, ?, CURDATE(), 1, 'present', ?)"
);
$attendanceStmt->execute([$studentB, $enrollmentB, $adminB]);

$summaryA = $dashboard->summary($schoolA);
tenant_assert((int)$summaryA['today_records'] === 0, 'Admin dashboard daily totals leaked another tenant.');

$audit = new AuditLogRepository();
$audit->record($adminA, 'tenant.test', 'tenant', null, ['school' => 'A']);
$audit->record($adminB, 'tenant.test', 'tenant', null, ['school' => 'B']);

$auditRows = $audit->search(null, 'tenant.test', null, null, null, 1, 50, $schoolA);
tenant_assert($auditRows['total'] === 1, 'School-scoped audit search leaked another tenant.');
tenant_assert((int)$auditRows['items'][0]['user_id'] === $adminA, 'School-scoped audit search returned another tenant actor.');

$auditSchool = $pdo->query(
    "SELECT school_id FROM audit_logs WHERE user_id = {$adminA} AND action = 'tenant.test' ORDER BY id DESC LIMIT 1"
)->fetchColumn();
tenant_assert((int)$auditSchool === $schoolA, 'New audit records did not retain tenant ownership.');

$imports = new SchoolImportRepository();
$batchB = $imports->createBatch(
    $adminB,
    $yearB,
    '2026/2027',
    'tenant-b.xlsx',
    str_repeat('b', 64),
    100,
    'validated',
    [
        'class_count' => 1,
        'valid_class_count' => 1,
        'warning_class_count' => 0,
        'error_class_count' => 0,
        'student_count' => 0,
        'valid_row_count' => 0,
        'warning_row_count' => 0,
        'error_row_count' => 0,
    ]
);
tenant_assert(
    $imports->findBatch($batchB, $schoolA) === null,
    'School-scoped import batch lookup leaked another tenant.'
);

$signatures = new SignatureRepository();
$signatureData = 'synthetic-tenant-signature';
$signatures->upsert($teacherA, $classA, $signatureData, $schoolA);
tenant_assert(
    $signatures->findByTeacherAndClass($teacherA, $classA, $schoolA) !== null,
    'Own-school signature was not persisted.'
);
tenant_assert(
    $signatures->findByTeacherAndClass($teacherA, $classA, $schoolB) === null,
    'Cross-school signature lookup leaked another tenant.'
);
$signatures->delete($teacherA, $classA, $schoolB);
tenant_assert(
    $signatures->findByTeacherAndClass($teacherA, $classA, $schoolA) !== null,
    'Cross-school signature delete affected another tenant.'
);
$signatures->delete($teacherA, $classA, $schoolA);

$teacherClasses = $classes->forUser($teacherA, 'teacher', $schoolA);

$teacherClassIds = array_map(
    static fn(array $row): int => (int)$row['id'],
    $teacherClasses
);

tenant_assert(
    !in_array($classB, $teacherClassIds, true),
    'Cross-school teacher assignment leaked through scoped class listing.'
);

tenant_assert(
    !$classes->hasAccess($teacherA, 'teacher', $classB, $schoolA),
    'Cross-school teacher access was granted despite tenant scope.'
);

tenant_assert(
    $classes->hasAccess($teacherA, 'teacher', $classA, $schoolA) === false,
    'Teacher access fixture unexpectedly grants an unassigned own-school class.'
);

require_once __DIR__ . '/../backend/vendor/autoload.php';

tenant_expect_scope_required(
    static fn() => (new \SAMS\Services\AcademicYearAdministrationService())->create(
        $adminA,
        '2027/2028',
        '2027-09-01',
        '2028-07-31'
    ),
    'Academic-year writer accepted a request without tenant scope.'
);

tenant_expect_scope_required(
    static fn() => (new \SAMS\Services\ClassAdministrationService())->create(
        $adminA,
        'SCOPE-TEST'
    ),
    'Class writer accepted a request without tenant scope.'
);

tenant_expect_scope_required(
    static fn() => (new \SAMS\Services\UserAdministrationService())->create(
        $adminA,
        'scope-test-user',
        'Scope Test User',
        'teacher',
        'ScopePassword123!'
    ),
    'User writer accepted a request without tenant scope.'
);

tenant_expect_scope_required(
    static fn() => (new \SAMS\Services\TeacherAdministrationService())->assignTeaching(
        $adminA,
        $teacherA,
        $subjectId,
        $classA
    ),
    'Teaching-assignment writer accepted a request without tenant scope.'
);

tenant_expect_scope_required(
    static fn() => (new \SAMS\Services\TeacherClassAdministrationService())->assign(
        $adminA,
        $teacherA,
        $classA
    ),
    'Teacher-class writer accepted a request without tenant scope.'
);

tenant_expect_scope_required(
    static fn() => (new \SAMS\Services\TeacherAttendanceService())->saveBulk(
        $teacherA,
        'teacher',
        $classA,
        [[
            'student_id' => 1,
            'attendance_date' => '2026-09-23',
            'period' => 1,
            'action' => 'upsert',
            'status' => 'present',
        ]]
    ),
    'Attendance writer accepted a request without tenant scope.'
);

tenant_expect_scope_required(
    static fn() => (new \SAMS\Services\StudentTransferService())->transfer(
        $adminA,
        'admin',
        $studentB,
        $classB,
        $classA,
        '2026-09-15'
    ),
    'Student-transfer writer accepted a request without tenant scope.'
);

tenant_expect_scope_required(
    static fn() => (new \SAMS\Services\SchoolWorkbookImportStagingService())->stage(
        '/tmp/nonexistent-scope-test.xlsx',
        $adminA,
        'scope-test.xlsx'
    ),
    'School-import staging writer accepted a request without tenant scope.'
);

tenant_expect_scope_required(
    static fn() => (new \SAMS\Services\SchoolWorkbookImportReconciliationService())->reconcile(
        $batchB,
        $adminB
    ),
    'School-import reconciliation accepted a request without tenant scope.'
);

tenant_expect_scope_required(
    static fn() => (new \SAMS\Services\SchoolWorkbookImportReconciliationService())->commit(
        $batchB,
        $adminB
    ),
    'School-import commit accepted a request without tenant scope.'
);

echo "[PASS] Tenant isolation repository and writer boundaries verified." . PHP_EOL;
