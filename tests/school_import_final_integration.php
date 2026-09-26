<?php

declare(strict_types=1);

$host = getenv('SAMS_TEST_DB_HOST') ?: '';
$port = getenv('SAMS_TEST_DB_PORT') ?: '3306';
$db = getenv('SAMS_TEST_DB_NAME') ?: '';
$user = getenv('SAMS_TEST_DB_USER') ?: '';
$pass = getenv('SAMS_TEST_DB_PASS') ?: '';

if ($host === '' || $db === '' || $user === '') {
    fwrite(STDERR, "Missing SAMS_TEST_DB_* environment variables." . PHP_EOL);
    exit(2);
}

function expect_true(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function execute_schema(PDO $pdo, string $sql): void
{
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    $statements = preg_split('/;\s*(?:\R|$)/', $sql, -1, PREG_SPLIT_NO_EMPTY);

    foreach ($statements as $statement) {
        if (trim($statement) === '') continue;
        $pdo->exec($statement);
    }
}

function createWorkbook(array $rows, string $className = '2BAC SP A'): string
{
    $path = tempnam(sys_get_temp_dir(), 'sams-school-import-final-');
    if ($path === false) {
        throw new RuntimeException('Unable to create workbook fixture path.');
    }

    $filename = $path . '.xlsx';
    @unlink($path);

    $workbook = new PhpOffice\PhpSpreadsheet\Spreadsheet();
    $sheet = $workbook->getActiveSheet();
    $sheet->setTitle('School Import');
    $sheet->fromArray([
        ['المؤسسة', 'Integration School'],
        ['القسم', $className],
        ['المستوى', '2BAC'],
        ['السنة الدراسية', '2026/2027'],
        [],
        ['ر.ت', 'الرمز', 'النسب', 'الإسم', 'تاريخ الازدياد'],
        ...$rows,
    ], null, 'A1');

    (new PhpOffice\PhpSpreadsheet\Writer\Xlsx($workbook))->save($filename);
    $workbook->disconnectWorksheets();
    unset($workbook);

    return $filename;
}

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, (int)$port, $db),
    $user,
    $pass,
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]
);

$schema = file_get_contents(__DIR__ . '/../database/schema.sql');
if ($schema === false) {
    throw new RuntimeException('Unable to read database/schema.sql.');
}
execute_schema($pdo, $schema);
execute_schema($pdo, $schema);

require_once __DIR__ . '/../backend/vendor/autoload.php';

$pdo->exec(
    "INSERT INTO academic_years (name, starts_on, ends_on, is_active)
     VALUES
       ('2025-2026', '2025-09-01', '2026-07-31', 0),
       ('2026-2027', '2026-09-01', '2027-07-31', 1)"
);

$pdo->exec(
    "INSERT INTO users (username, full_name, password_hash, role)
     VALUES ('admin', 'Integration Admin', 'hash-admin', 'admin')"
);

$targetAcademicYearId = (int)$pdo->query(
    "SELECT id FROM academic_years WHERE name = '2026-2027'"
)->fetchColumn();
$oldAcademicYearId = (int)$pdo->query(
    "SELECT id FROM academic_years WHERE name = '2025-2026'"
)->fetchColumn();
$adminId = (int)$pdo->query(
    "SELECT id FROM users WHERE username = 'admin'"
)->fetchColumn();

$pdo->exec(
    "INSERT INTO classes (academic_year_id, name, level, branch)
     VALUES
       ({$oldAcademicYearId}, '2BAC SP A', '2BAC', 'SP'),
       ({$targetAcademicYearId}, '2BAC SP A', '2BAC', 'SP'),
       ({$targetAcademicYearId}, '2BAC SP B', '2BAC', 'SP')"
);

$oldClassId = (int)$pdo->query(
    "SELECT id FROM classes WHERE academic_year_id = {$oldAcademicYearId} AND name = '2BAC SP A'"
)->fetchColumn();
$targetClassId = (int)$pdo->query(
    "SELECT id FROM classes WHERE academic_year_id = {$targetAcademicYearId} AND name = '2BAC SP A'"
)->fetchColumn();

$pdo->exec(
    "INSERT INTO students
        (class_id, student_number, massar_code, birth_date, first_name, last_name)
     VALUES
        ({$oldClassId}, '1', 'MC-EXIST', '2009-01-02', 'GivenA', 'FamilyA')"
);
$existingStudentId = (int)$pdo->lastInsertId();

$pdo->exec(
    "INSERT INTO student_enrollments (student_id, class_id, starts_on, ends_on)
     VALUES ({$existingStudentId}, {$oldClassId}, '2025-09-01', '2026-07-31')"
);

$validWorkbook = createWorkbook([
    [1, 'MC-EXIST', 'FamilyA', 'GivenA', '2009-01-02'],
    [2, 'MC-NEW', 'FamilyB', 'GivenB', '2009-02-03'],
]);

try {
    $beforeStudents = (int)$pdo->query('SELECT COUNT(*) FROM students')->fetchColumn();
    $beforeEnrollments = (int)$pdo->query('SELECT COUNT(*) FROM student_enrollments')->fetchColumn();

    $staging = new SAMS\Services\SchoolWorkbookImportStagingService();
    $reconciliation = new SAMS\Services\SchoolWorkbookImportReconciliationService();

    $staged = $staging->stage(
        $validWorkbook,
        $adminId,
        'valid-school.xlsx',
        $targetAcademicYearId
    );

    expect_true($staged['status'] === 'validated', 'Valid workbook should enter validated staging state.');

    $reconciled = $reconciliation->reconcile((int)$staged['batch_id'], $adminId);
    expect_true($reconciled['ready_to_import'] === true, 'Valid workbook should be ready after reconciliation.');
    expect_true($reconciled['summary']['new_students'] === 1, 'Reconciliation should identify one new student.');
    expect_true($reconciled['summary']['existing_students'] === 1, 'Reconciliation should identify one existing student.');
    expect_true(
        (int)$pdo->query('SELECT COUNT(*) FROM students')->fetchColumn() === $beforeStudents,
        'Reconciliation must not create production students.'
    );

    $committed = $reconciliation->commit((int)$staged['batch_id'], $adminId);
    expect_true($committed['summary']['new_students'] === 1, 'Commit should create one new student.');
    expect_true($committed['summary']['existing_students'] === 1, 'Commit should reuse one existing student.');
    expect_true($committed['summary']['enrollments_created'] === 2, 'Commit should create two target-year enrollments.');

    expect_true(
        (int)$pdo->query('SELECT COUNT(*) FROM students')->fetchColumn() === $beforeStudents + 1,
        'Commit should add exactly one student record.'
    );
    expect_true(
        (int)$pdo->query('SELECT COUNT(*) FROM student_enrollments')->fetchColumn() === $beforeEnrollments + 2,
        'Commit should add exactly two enrollments.'
    );

    $newStudent = $pdo->query(
        "SELECT id, class_id FROM students WHERE massar_code = 'MC-NEW' LIMIT 1"
    )->fetch();
    expect_true(is_array($newStudent), 'New Massar student was not created.');

    $reusedStudent = $pdo->query(
        "SELECT id, class_id FROM students WHERE massar_code = 'MC-EXIST' LIMIT 1"
    )->fetch();
    expect_true((int)$reusedStudent['id'] === $existingStudentId, 'Existing Massar must reuse the same student id.');
    expect_true((int)$reusedStudent['class_id'] === $targetClassId, 'Active-year import should move current class pointer to target class.');
    expect_true((int)$newStudent['class_id'] === $targetClassId, 'New student should point to the target class.');
    expect_true($pdo->query(
        "SELECT student_number FROM students WHERE id = " . (int)$newStudent['id']
    )->fetchColumn() === null, 'Roster order must not be stored as student_number.');

    $targetEnrollmentCount = (int)$pdo->query(
        "SELECT COUNT(*)
         FROM student_enrollments
         WHERE class_id = {$targetClassId}
           AND student_id IN ({$existingStudentId}, " . (int)$newStudent['id'] . ")
           AND starts_on = '2026-09-01'"
    )->fetchColumn();
    expect_true($targetEnrollmentCount === 2, 'Both students need target-year enrollment records.');

    $storedBatchStatus = (string)$pdo->query(
        "SELECT status FROM school_import_batches WHERE id = " . (int)$staged['batch_id']
    )->fetchColumn();
    expect_true($storedBatchStatus === 'imported', 'Imported batch status was not persisted.');

    $rowsImported = (int)$pdo->query(
        "SELECT COUNT(*) FROM school_import_rows
         WHERE import_class_id IN (
             SELECT id FROM school_import_classes WHERE batch_id = " . (int)$staged['batch_id'] . "
         )
           AND status = 'imported'"
    )->fetchColumn();
    expect_true($rowsImported === 2, 'All valid school-import rows should be marked imported.');

    $again = $reconciliation->commit((int)$staged['batch_id'], $adminId);
    expect_true($again['already_imported'] === true, 'A second commit must be idempotent.');
    expect_true(
        (int)$pdo->query('SELECT COUNT(*) FROM students')->fetchColumn() === $beforeStudents + 1,
        'Idempotent commit must not create duplicate students.'
    );

    $conflictWorkbook = createWorkbook([
        [1, 'MC-EXIST', 'FamilyA', 'GivenA', '2008-12-31'],
    ]);
    try {
        $conflictStage = $staging->stage(
            $conflictWorkbook,
            $adminId,
            'identity-conflict.xlsx',
            $targetAcademicYearId
        );
        $conflictReconcile = $reconciliation->reconcile((int)$conflictStage['batch_id'], $adminId);
        expect_true($conflictReconcile['ready_to_import'] === false, 'Identity conflict must block import.');

        $conflictRow = $pdo->query(
            "SELECT status, match_status, issues
             FROM school_import_rows
             WHERE import_class_id IN (
                 SELECT id FROM school_import_classes WHERE batch_id = " . (int)$conflictStage['batch_id'] . "
             )
             LIMIT 1"
        )->fetch();
        expect_true($conflictRow['status'] === 'error', 'Conflicting row must be marked error.');
        expect_true($conflictRow['match_status'] === 'conflict', 'Conflicting row must have conflict match status.');
        expect_true(
            str_contains((string)$conflictRow['issues'], 'identity_conflict_birth_date'),
            'Birth-date conflict must be persisted.'
        );

        $conflictBlocked = false;
        try {
            $reconciliation->commit((int)$conflictStage['batch_id'], $adminId);
        } catch (SAMS\Exceptions\SchoolImportWorkflowException) {
            $conflictBlocked = true;
        }
        expect_true($conflictBlocked, 'Commit must reject unresolved identity conflicts.');
    } finally {
        @unlink($conflictWorkbook);
    }



    $enrollmentConflictWorkbook = createWorkbook(
        [[1, 'MC-EXIST', 'FamilyA', 'GivenA', '2009-01-02']],
        '2BAC SP B'
    );
    try {
        $enrollmentStage = $staging->stage(
            $enrollmentConflictWorkbook,
            $adminId,
            'enrollment-conflict.xlsx',
            $targetAcademicYearId
        );
        $enrollmentReconcile = $reconciliation->reconcile((int)$enrollmentStage['batch_id'], $adminId);
        expect_true($enrollmentReconcile['ready_to_import'] === false, 'Existing enrollment in another target class must block import.');

        $enrollmentRow = $pdo->query(
            "SELECT status, match_status, issues
             FROM school_import_rows
             WHERE import_class_id IN (
                 SELECT id FROM school_import_classes WHERE batch_id = " . (int)$enrollmentStage['batch_id'] . "
             )
             LIMIT 1"
        )->fetch();
        expect_true($enrollmentRow['status'] === 'error', 'Enrollment conflict row must be marked error.');
        expect_true($enrollmentRow['match_status'] === 'conflict', 'Enrollment conflict row must be marked conflict.');
        expect_true(
            str_contains((string)$enrollmentRow['issues'], 'student_enrollment_conflict'),
            'Enrollment conflict must be persisted.'
        );
    } finally {
        @unlink($enrollmentConflictWorkbook);
    }

    $unmappedWorkbook = createWorkbook(
        [[1, 'MC-UNMAPPED', 'FamilyC', 'GivenC', '2009-03-03']],
        '2BAC SP Z'
    );
    try {
        $unmappedStage = $staging->stage(
            $unmappedWorkbook,
            $adminId,
            'unmapped-class.xlsx',
            $targetAcademicYearId
        );
        $unmappedReconcile = $reconciliation->reconcile((int)$unmappedStage['batch_id'], $adminId);
        expect_true($unmappedReconcile['ready_to_import'] === false, 'Unmapped class must block import.');

        $unmappedBlocked = false;
        try {
            $reconciliation->commit((int)$unmappedStage['batch_id'], $adminId);
        } catch (SAMS\Exceptions\SchoolImportWorkflowException) {
            $unmappedBlocked = true;
        }
        expect_true($unmappedBlocked, 'Commit must reject an unmapped target class.');
    } finally {
        @unlink($unmappedWorkbook);
    }

    $transactionWorkbook = createWorkbook([
        [10, 'MC-TX-1', 'FamilyD', 'GivenD', '2009-04-04'],
        [11, 'MC-TXFAIL', 'FamilyE', 'GivenE', '2009-05-05'],
    ]);
    try {
        $transactionStage = $staging->stage(
            $transactionWorkbook,
            $adminId,
            'transactional-failure.xlsx',
            $targetAcademicYearId
        );
        $transactionReconcile = $reconciliation->reconcile((int)$transactionStage['batch_id'], $adminId);
        expect_true($transactionReconcile['ready_to_import'] === true, 'Transactional failure fixture should reconcile cleanly.');

        $pdo->exec(
            "CREATE TRIGGER sams_test_school_import_fail
             BEFORE INSERT ON students
             FOR EACH ROW
             BEGIN
                 IF NEW.massar_code = 'MC-TXFAIL' THEN
                     SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'intentional integration rollback';
                 END IF;
             END"
        );

        $txBeforeStudents = (int)$pdo->query('SELECT COUNT(*) FROM students')->fetchColumn();
        $txBeforeEnrollments = (int)$pdo->query('SELECT COUNT(*) FROM student_enrollments')->fetchColumn();

        $rolledBack = false;
        try {
            $reconciliation->commit((int)$transactionStage['batch_id'], $adminId);
        } catch (Throwable) {
            $rolledBack = true;
        }

        expect_true($rolledBack, 'Triggered production failure should abort the final import.');
        expect_true(
            (int)$pdo->query('SELECT COUNT(*) FROM students')->fetchColumn() === $txBeforeStudents,
            'Transactional failure must roll back every student write.'
        );
        expect_true(
            (int)$pdo->query('SELECT COUNT(*) FROM student_enrollments')->fetchColumn() === $txBeforeEnrollments,
            'Transactional failure must roll back every enrollment write.'
        );
        expect_true(
            (string)$pdo->query(
                "SELECT status FROM school_import_batches WHERE id = " . (int)$transactionStage['batch_id']
            )->fetchColumn() === 'validated',
            'Failed import must leave the staging batch retryable.'
        );
    } finally {
        $pdo->exec('DROP TRIGGER IF EXISTS sams_test_school_import_fail');
        @unlink($transactionWorkbook);
    }

    echo "[PASS] Whole-school import: mapping, Massar reconciliation, conflicts, idempotence, and atomic rollback." . PHP_EOL;
} finally {
    @unlink($validWorkbook);
}
