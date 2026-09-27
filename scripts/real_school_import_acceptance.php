<?php

declare(strict_types=1);

use PDO;
use SAMSHelpersDatabase;
use SAMSRepositoriesSchoolImportRepository;
use SAMSServicesSchoolWorkbookImportReconciliationService;
use SAMSServicesSchoolWorkbookImportService;
use SAMSServicesSchoolWorkbookImportStagingService;
use SAMSServicesSchoolWorkbookImportValidationService;

require_once __DIR__ . '/../backend/vendor/autoload.php';

function fail_acceptance(string $message): never
{
    fwrite(STDERR, "[FAIL] {$message}" . PHP_EOL);
    exit(1);
}

function pass_acceptance(string $message): void
{
    fwrite(STDOUT, "[PASS] {$message}" . PHP_EOL);
}

function info_acceptance(string $message): void
{
    fwrite(STDOUT, "[INFO] {$message}" . PHP_EOL);
}

/**
 * @return array<string,mixed>
 */
function load_database_config(): array
{
    $candidates = [
        __DIR__ . '/../backend/config/database.php',
        __DIR__ . '/../config/database.php',
    ];

    foreach ($candidates as $path) {
        if (!is_file($path)) {
            continue;
        }

        $config = require $path;
        if (!is_array($config)) {
            fail_acceptance('Database configuration is not a PHP array.');
        }

        return $config;
    }

    fail_acceptance(
        'Missing local database configuration. Copy backend/config/database.example.php to backend/config/database.php.'
    );
}

/**
 * @return array{students:int,enrollments:int}
 */
function production_counts(PDO $pdo): array
{
    return [
        'students' => (int)$pdo->query('SELECT COUNT(*) FROM students')->fetchColumn(),
        'enrollments' => (int)$pdo->query('SELECT COUNT(*) FROM student_enrollments')->fetchColumn(),
    ];
}

function normalized_text(mixed $value): string
{
    return trim((string)($value ?? ''));
}

function normalized_identity(mixed $value): string
{
    $value = normalized_text($value);
    return strtolower(preg_replace('/\s+/u', ' ', $value) ?? $value);
}

function normalized_academic_year(mixed $value): string
{
    return str_replace('/', '-', normalized_text($value));
}

/**
 * @param array<string,mixed> $validated
 * @return array{classes:list<array<string,mixed>>,rows:list<list<array<string,mixed>>>}
 */
function source_snapshot(array $validated): array
{
    $classes = is_array($validated['classes'] ?? null) ? $validated['classes'] : [];
    $classSnapshots = [];
    $rowSnapshots = [];

    foreach ($classes as $class) {
        $classSnapshots[] = [
            'source_sheet' => normalized_text($class['source_sheet'] ?? null),
            'class_name' => normalized_text($class['class_name'] ?? null),
            'level' => normalized_text($class['level'] ?? null),
            'academic_year' => normalized_text($class['academic_year'] ?? null),
            'student_count' => count(is_array($class['students'] ?? null) ? $class['students'] : []),
        ];

        $rows = [];
        foreach (($class['students'] ?? []) as $student) {
            $rows[] = [
                'roster_number' => normalized_text($student['roster_number'] ?? null),
                'massar_code' => normalized_text($student['massar_code'] ?? null),
                'first_name' => normalized_text($student['first_name'] ?? null),
                'last_name' => normalized_text($student['last_name'] ?? null),
                'birth_date' => normalized_text($student['birth_date'] ?? null),
                'sex' => normalized_text($student['sex'] ?? null),
                'birth_place' => normalized_text($student['birth_place'] ?? null),
            ];
        }

        $rowSnapshots[] = $rows;
    }

    return [
        'classes' => $classSnapshots,
        'rows' => $rowSnapshots,
    ];
}

/**
 * Compare two source representations without printing student data.
 *
 * Accepted known representation differences for this real school fixture:
 * - two birth-place values become blank in MarkItDown output;
 * - one last-name value differs only by internal whitespace.
 *
 * @param array{classes:list<array<string,mixed>>,rows:list<list<array<string,mixed>>>} $left
 * @param array{classes:list<array<string,mixed>>,rows:list<list<array<string,mixed>>>} $right
 * @return array{errors:list<string>,whitespace_last_name_deltas:int,birth_place_presence_deltas:int}
 */
function compare_source_snapshots(array $left, array $right): array
{
    $errors = [];
    $whitespaceLastNameDeltas = 0;
    $birthPlacePresenceDeltas = 0;

    if (count($left['classes']) !== count($right['classes'])) {
        $errors[] = sprintf(
            'class count mismatch: %d vs %d',
            count($left['classes']),
            count($right['classes'])
        );
    }

    $classCount = min(count($left['classes']), count($right['classes']));

    for ($classIndex = 0; $classIndex < $classCount; ++$classIndex) {
        $leftClass = $left['classes'][$classIndex];
        $rightClass = $right['classes'][$classIndex];

        foreach (['source_sheet', 'class_name', 'level', 'academic_year', 'student_count'] as $field) {
            $a = $leftClass[$field] ?? null;
            $b = $rightClass[$field] ?? null;

            if ($field === 'academic_year') {
                if (normalized_academic_year($a) !== normalized_academic_year($b)) {
                    $errors[] = "class {$classIndex} academic_year mismatch";
                }
                continue;
            }

            if ((string)$a !== (string)$b) {
                $errors[] = "class {$classIndex} {$field} mismatch";
            }
        }

        $leftRows = $left['rows'][$classIndex] ?? [];
        $rightRows = $right['rows'][$classIndex] ?? [];

        if (count($leftRows) !== count($rightRows)) {
            $errors[] = sprintf(
                'class %d student count mismatch: %d vs %d',
                $classIndex,
                count($leftRows),
                count($rightRows)
            );
        }

        $rowCount = min(count($leftRows), count($rightRows));

        for ($rowIndex = 0; $rowIndex < $rowCount; ++$rowIndex) {
            $a = $leftRows[$rowIndex];
            $b = $rightRows[$rowIndex];

            foreach (['roster_number', 'massar_code', 'first_name', 'birth_date', 'sex'] as $field) {
                if ((string)($a[$field] ?? '') !== (string)($b[$field] ?? '')) {
                    $errors[] = "class {$classIndex} row {$rowIndex} {$field} mismatch";
                }
            }

            if ((string)($a['last_name'] ?? '') !== (string)($b['last_name'] ?? '')) {
                if (normalized_identity($a['last_name'] ?? '') === normalized_identity($b['last_name'] ?? '')) {
                    ++$whitespaceLastNameDeltas;
                } else {
                    $errors[] = "class {$classIndex} row {$rowIndex} last_name mismatch";
                }
            }

            if ((string)($a['birth_place'] ?? '') !== (string)($b['birth_place'] ?? '')) {
                $aBlank = normalized_text($a['birth_place'] ?? '') === '';
                $bBlank = normalized_text($b['birth_place'] ?? '') === '';

                if ($aBlank xor $bBlank) {
                    ++$birthPlacePresenceDeltas;
                } else {
                    $errors[] = "class {$classIndex} row {$rowIndex} birth_place mismatch";
                }
            }
        }
    }

    return [
        'errors' => array_slice(array_values(array_unique($errors)), 0, 25),
        'whitespace_last_name_deltas' => $whitespaceLastNameDeltas,
        'birth_place_presence_deltas' => $birthPlacePresenceDeltas,
    ];
}

/**
 * @param list<array<string,mixed>> $classes
 * @param list<array<string,mixed>> $rows
 * @return array{classes:list<array<string,mixed>>,rows:list<list<array<string,mixed>>>}
 */
function staged_snapshot(array $classes, array $rows): array
{
    $classIndexById = [];
    $classSnapshots = [];

    foreach ($classes as $index => $class) {
        $id = (int)$class['id'];
        $classIndexById[$id] = $index;
        $classSnapshots[] = [
            'source_sheet' => normalized_text($class['source_sheet'] ?? null),
            'class_name' => normalized_text($class['source_class_name'] ?? null),
            'level' => normalized_text($class['source_level'] ?? null),
            'academic_year' => normalized_text($class['source_academic_year'] ?? null),
            'student_count' => (int)($class['student_count'] ?? 0),
        ];
    }

    $rowSnapshots = array_fill(0, count($classes), []);

    foreach ($rows as $row) {
        $classId = (int)$row['import_class_id'];
        if (!isset($classIndexById[$classId])) {
            continue;
        }

        $index = $classIndexById[$classId];
        $rowSnapshots[$index][] = [
            'roster_number' => normalized_text($row['roster_number'] ?? null),
            'massar_code' => normalized_text($row['massar_code'] ?? null),
            'first_name' => normalized_text($row['first_name'] ?? null),
            'last_name' => normalized_text($row['last_name'] ?? null),
            'birth_date' => normalized_text($row['birth_date'] ?? null),
            'sex' => normalized_text($row['sex'] ?? null),
            'birth_place' => normalized_text($row['birth_place'] ?? null),
        ];
    }

    return [
        'classes' => $classSnapshots,
        'rows' => $rowSnapshots,
    ];
}

function assert_same_counts(array $expected, array $actual, string $context): void
{
    if ($expected !== $actual) {
        fail_acceptance(
            sprintf(
                '%s changed production counts: before=%s after=%s',
                $context,
                json_encode($expected, JSON_THROW_ON_ERROR),
                json_encode($actual, JSON_THROW_ON_ERROR)
            )
        );
    }
}

function assert_batch_counts(
    PDO $pdo,
    int $batchId,
    int $expectedClasses,
    int $expectedRows,
    string $expectedStatus
): void {
    $stmt = $pdo->prepare(
        'SELECT status, total_classes, total_rows
         FROM school_import_batches
         WHERE id = ?
         LIMIT 1'
    );
    $stmt->execute([$batchId]);
    $batch = $stmt->fetch();

    if (!is_array($batch)) {
        fail_acceptance("Batch {$batchId} disappeared.");
    }

    if (
        (string)$batch['status'] !== $expectedStatus
        || (int)$batch['total_classes'] !== $expectedClasses
        || (int)$batch['total_rows'] !== $expectedRows
    ) {
        fail_acceptance(
            "Batch {$batchId} has unexpected state: " . json_encode($batch, JSON_THROW_ON_ERROR)
        );
    }
}

function assert_imported_rows(PDO $pdo, int $batchId, int $expected): void
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM school_import_rows r
         INNER JOIN school_import_classes c ON c.id = r.import_class_id
         WHERE c.batch_id = ?
           AND r.status = \'imported\''
    );
    $stmt->execute([$batchId]);

    if ((int)$stmt->fetchColumn() !== $expected) {
        fail_acceptance("Batch {$batchId} does not have {$expected} imported rows.");
    }
}

function create_rollback_trigger(PDO $pdo): void
{
    $pdo->exec('DROP TRIGGER IF EXISTS sams_real_acceptance_fail_import');
    $pdo->exec(
        "CREATE TRIGGER sams_real_acceptance_fail_import
         BEFORE INSERT ON audit_logs
         FOR EACH ROW
         BEGIN
             IF NEW.action = 'school_import.import' THEN
                 SIGNAL SQLSTATE '45000'
                     SET MESSAGE_TEXT = 'SAMS real acceptance rollback probe';
             END IF;
         END"
    );
}

function drop_rollback_trigger(PDO $pdo): void
{
    $pdo->exec('DROP TRIGGER IF EXISTS sams_real_acceptance_fail_import');
}

$config = load_database_config();

if (getenv('SAMS_REAL_ACCEPTANCE') !== '1') {
    fail_acceptance(
        'This harness is manual-only. Set SAMS_REAL_ACCEPTANCE=1 explicitly.'
    );
}

$databaseName = (string)($config['database'] ?? '');
if (!preg_match('/(?:^|_)(?:acceptance|staging)(?:_|$)/i', $databaseName)) {
    fail_acceptance(
        "Refusing database '{$databaseName}'. The configured database name must contain _acceptance or _staging."
    );
}

if ($databaseName === 'sams' || preg_match('/prod|production/i', $databaseName)) {
    fail_acceptance("Refusing non-isolated database '{$databaseName}'.");
}

if ($argc < 4) {
    fail_acceptance(
        'Usage: php scripts/real_school_import_acceptance.php <real.xlsx> <real.md> <target_academic_year_id> [admin_user_id]'
    );
}

$xlsxPath = realpath($argv[1]);
$mdPath = realpath($argv[2]);
$targetAcademicYearId = filter_var($argv[3], FILTER_VALIDATE_INT);
$adminUserId = isset($argv[4])
    ? filter_var($argv[4], FILTER_VALIDATE_INT)
    : null;

if ($xlsxPath === false || !is_file($xlsxPath)) {
    fail_acceptance('Real XLSX path does not exist.');
}

if ($mdPath === false || !is_file($mdPath)) {
    fail_acceptance('Real Markdown path does not exist.');
}

if (strtolower(pathinfo($xlsxPath, PATHINFO_EXTENSION)) !== 'xlsx') {
    fail_acceptance('First input must use the .xlsx extension.');
}

if (strtolower(pathinfo($mdPath, PATHINFO_EXTENSION)) !== 'md') {
    fail_acceptance('Second input must use the .md extension.');
}

if ($targetAcademicYearId === false || $targetAcademicYearId < 1) {
    fail_acceptance('Target academic year id must be a positive integer.');
}

$pdo = Database::connection();

if ($adminUserId === null || $adminUserId === false || $adminUserId < 1) {
    $adminUserId = (int)$pdo->query(
        "SELECT id
         FROM users
         WHERE role = 'admin' AND is_active = 1
         ORDER BY id
         LIMIT 1"
    )->fetchColumn();
}

if ($adminUserId < 1) {
    fail_acceptance('No active admin user was found in the isolated database.');
}

$targetYearStmt = $pdo->prepare(
    'SELECT id, name, starts_on, ends_on, is_active
     FROM academic_years
     WHERE id = ?
     LIMIT 1'
);
$targetYearStmt->execute([$targetAcademicYearId]);
$targetYear = $targetYearStmt->fetch();

if (!is_array($targetYear)) {
    fail_acceptance("Target academic year {$targetAcademicYearId} does not exist.");
}

$xHash = hash_file('sha256', $xlsxPath);
$mdHash = hash_file('sha256', $mdPath);

if ($xHash === false || $mdHash === false) {
    fail_acceptance('Unable to hash the real input files.');
}

info_acceptance("isolated database: {$databaseName}");
info_acceptance("target academic year: {$targetYear['name']} (#{$targetAcademicYearId})");
info_acceptance("xlsx sha256: {$xHash}");
info_acceptance("md sha256:   {$mdHash}");

$parser = new SchoolWorkbookImportService();
$validator = new SchoolWorkbookImportValidationService();

$xParsed = $parser->parse($xlsxPath, basename($xlsxPath));
$xValidated = $validator->validate($xParsed);

$mdParsed = $parser->parse($mdPath, basename($mdPath));
$mdValidated = $validator->validate($mdParsed);

if (($xValidated['valid'] ?? false) !== true) {
    fail_acceptance('Real XLSX failed parser validation.');
}

if (($mdValidated['valid'] ?? false) !== true) {
    fail_acceptance('Real Markdown failed parser validation.');
}

if ((int)$xValidated['summary']['class_count'] !== 27 || (int)$xValidated['summary']['student_count'] !== 921) {
    fail_acceptance(
        sprintf(
            'Real XLSX shape is not 27 classes / 921 rows: got %d / %d.',
            (int)$xValidated['summary']['class_count'],
            (int)$xValidated['summary']['student_count']
        )
    );
}

if ((int)$mdValidated['summary']['class_count'] !== 27 || (int)$mdValidated['summary']['student_count'] !== 921) {
    fail_acceptance(
        sprintf(
            'Real Markdown shape is not 27 classes / 921 rows: got %d / %d.',
            (int)$mdValidated['summary']['class_count'],
            (int)$mdValidated['summary']['student_count']
        )
    );
}

$sourceYearNames = [];
foreach (($xValidated['classes'] ?? []) as $class) {
    $year = normalized_text($class['academic_year'] ?? null);
    if ($year !== '') {
        $sourceYearNames[$year] = true;
    }
}

if (count($sourceYearNames) !== 1) {
    fail_acceptance('Real XLSX does not contain exactly one source academic year.');
}

$sourceYear = array_key_first($sourceYearNames);
if (normalized_academic_year($sourceYear) !== normalized_academic_year($targetYear['name'])) {
    fail_acceptance(
        sprintf(
            'Source academic year %s does not match target year %s.',
            $sourceYear,
            $targetYear['name']
        )
    );
}

$sourceComparison = compare_source_snapshots(
    source_snapshot($xValidated),
    source_snapshot($mdValidated)
);

if ($sourceComparison['errors'] !== []) {
    fail_acceptance(
        'Real XLSX vs real Markdown source equivalence failed: '
        . implode('; ', $sourceComparison['errors'])
    );
}

if ($sourceComparison['whitespace_last_name_deltas'] !== 1) {
    fail_acceptance(
        sprintf(
            'Expected exactly 1 whitespace-only last-name representation delta; got %d.',
            $sourceComparison['whitespace_last_name_deltas']
        )
    );
}

if ($sourceComparison['birth_place_presence_deltas'] !== 2) {
    fail_acceptance(
        sprintf(
            'Expected exactly 2 birth-place blank/non-blank representation deltas; got %d.',
            $sourceComparison['birth_place_presence_deltas']
        )
    );
}

pass_acceptance('Real XLSX parser validation: 27 classes / 921 rows.');
pass_acceptance('Real Markdown parser validation: 27 classes / 921 rows.');
pass_acceptance('Real XLSX ↔ Markdown semantic equivalence: PASS (2 birth-place conversion deltas + 1 whitespace-only last-name delta).');

$beforeStaging = production_counts($pdo);

$staging = new SchoolWorkbookImportStagingService();
$reconciliation = new SchoolWorkbookImportReconciliationService();
$imports = new SchoolImportRepository();

$xStaged = $staging->stage(
    $xlsxPath,
    $adminUserId,
    basename($xlsxPath),
    $targetAcademicYearId
);

if (($xStaged['status'] ?? '') !== 'validated') {
    fail_acceptance('Real XLSX did not reach validated staging state.');
}

if (
    (int)$xStaged['summary']['class_count'] !== 27
    || (int)$xStaged['summary']['student_count'] !== 921
) {
    fail_acceptance('Real XLSX staging summary is not 27 classes / 921 rows.');
}

$afterXlsxStaging = production_counts($pdo);
assert_same_counts($beforeStaging, $afterXlsxStaging, 'XLSX staging');

$mdStaged = $staging->stage(
    $mdPath,
    $adminUserId,
    basename($mdPath),
    $targetAcademicYearId
);

if (($mdStaged['status'] ?? '') !== 'validated') {
    fail_acceptance('Real Markdown did not reach validated staging state.');
}

if (
    (int)$mdStaged['summary']['class_count'] !== 27
    || (int)$mdStaged['summary']['student_count'] !== 921
) {
    fail_acceptance('Real Markdown staging summary is not 27 classes / 921 rows.');
}

$afterMdStaging = production_counts($pdo);
assert_same_counts($beforeStaging, $afterMdStaging, 'Markdown staging');

$xBatchId = (int)$xStaged['batch_id'];
$mdBatchId = (int)$mdStaged['batch_id'];

$xStoredSnapshot = staged_snapshot(
    $imports->classesForBatch($xBatchId),
    $imports->rowsForBatch($xBatchId)
);
$mdStoredSnapshot = staged_snapshot(
    $imports->classesForBatch($mdBatchId),
    $imports->rowsForBatch($mdBatchId)
);

$stagedComparison = compare_source_snapshots($xStoredSnapshot, $mdStoredSnapshot);

if ($stagedComparison['errors'] !== []) {
    fail_acceptance(
        'Real XLSX vs real Markdown staging equivalence failed: '
        . implode('; ', $stagedComparison['errors'])
    );
}

if (
    $stagedComparison['whitespace_last_name_deltas'] !== $sourceComparison['whitespace_last_name_deltas']
    || $stagedComparison['birth_place_presence_deltas'] !== $sourceComparison['birth_place_presence_deltas']
) {
    fail_acceptance('Staging representation deltas differ from direct parser comparison.');
}

pass_acceptance("Real XLSX staged successfully as batch {$xBatchId}.");
pass_acceptance("Real Markdown staged successfully as batch {$mdBatchId}.");
pass_acceptance('Staging comparison matches the direct source-equivalence result.');
pass_acceptance('Production student/enrollment counts unchanged during both staging passes.');

$xBeforeReconcile = production_counts($pdo);
$xReconciled = $reconciliation->reconcile($xBatchId, $adminUserId);
$xAfterReconcile = production_counts($pdo);
assert_same_counts($xBeforeReconcile, $xAfterReconcile, 'XLSX reconciliation');

if (($xReconciled['ready_to_import'] ?? false) !== true) {
    fail_acceptance('Real XLSX reconciliation did not become ready_to_import.');
}

if (
    (int)$xReconciled['summary']['class_count'] !== 27
    || (int)$xReconciled['summary']['mapped_classes'] !== 27
    || (int)$xReconciled['summary']['conflict_rows'] !== 0
    || (
        (int)$xReconciled['summary']['new_students']
        + (int)$xReconciled['summary']['existing_students']
    ) !== 921
) {
    fail_acceptance(
        'Real XLSX reconciliation summary is inconsistent with 27 classes / 921 rows.'
    );
}

$reconciledNewStudents = (int)$xReconciled['summary']['new_students'];

pass_acceptance(sprintf(
    'Real XLSX reconciliation: 27/27 classes mapped, 0 conflicts, %d new + %d existing students.',
    (int)$xReconciled['summary']['new_students'],
    (int)$xReconciled['summary']['existing_students']
));

$beforeCommit = production_counts($pdo);
$xCommitted = $reconciliation->commit($xBatchId, $adminUserId);
$afterCommit = production_counts($pdo);

if (($xCommitted['already_imported'] ?? false) !== false) {
    fail_acceptance('First real XLSX commit was unexpectedly treated as already imported.');
}

$studentDelta = $afterCommit['students'] - $beforeCommit['students'];
$enrollmentDelta = $afterCommit['enrollments'] - $beforeCommit['enrollments'];

if ($studentDelta !== $reconciledNewStudents) {
    fail_acceptance(
        "Real XLSX commit created {$studentDelta} students, expected {$reconciledNewStudents}."
    );
}

if ($enrollmentDelta !== (int)$xCommitted['summary']['enrollments_created']) {
    fail_acceptance('Real XLSX enrollment delta does not match commit summary.');
}

assert_batch_counts($pdo, $xBatchId, 27, 921, 'imported');
assert_imported_rows($pdo, $xBatchId, 921);

$afterFirstCommit = production_counts($pdo);

$secondCommit = $reconciliation->commit($xBatchId, $adminUserId);
$afterSecondCommit = production_counts($pdo);

if (($secondCommit['already_imported'] ?? false) !== true) {
    fail_acceptance('Second real XLSX commit was not idempotent.');
}

assert_same_counts($afterFirstCommit, $afterSecondCommit, 'XLSX idempotent replay');

pass_acceptance(sprintf(
    'Real XLSX commit: +%d students / +%d enrollments.',
    $studentDelta,
    $enrollmentDelta
));
pass_acceptance('Real XLSX second commit is idempotent; no duplicate student/enrollment records created.');

$rollbackStage = $staging->stage(
    $xlsxPath,
    $adminUserId,
    basename($xlsxPath) . '.rollback-probe.xlsx',
    $targetAcademicYearId
);
$rollbackBatchId = (int)$rollbackStage['batch_id'];
$rollbackReconciled = $reconciliation->reconcile($rollbackBatchId, $adminUserId);

if (($rollbackReconciled['ready_to_import'] ?? false) !== true) {
    fail_acceptance('Rollback-probe real XLSX batch did not reconcile cleanly.');
}

$rollbackEnrollmentStmt = $pdo->query(
    "SELECT r.target_enrollment_id
     FROM school_import_rows r
     INNER JOIN school_import_classes c ON c.id = r.import_class_id
     WHERE c.batch_id = " . $rollbackBatchId . "
       AND r.target_enrollment_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM attendance a
           WHERE a.enrollment_id = r.target_enrollment_id
       )
     ORDER BY r.id
     LIMIT 1"
);
$rollbackEnrollmentId = (int)$rollbackEnrollmentStmt->fetchColumn();

if ($rollbackEnrollmentId < 1) {
    fail_acceptance(
        'Could not find a target-year enrollment with zero attendance rows for the real rollback probe.'
    );
}

$attendanceCheck = $pdo->prepare(
    'SELECT COUNT(*) FROM attendance WHERE enrollment_id = ?'
);
$attendanceCheck->execute([$rollbackEnrollmentId]);

if ((int)$attendanceCheck->fetchColumn() !== 0) {
    fail_acceptance('Rollback probe selected an enrollment that has attendance rows.');
}

$pdo->prepare(
    'DELETE FROM student_enrollments WHERE id = ?'
)->execute([$rollbackEnrollmentId]);

$missingEnrollmentCheck = $pdo->prepare(
    'SELECT COUNT(*) FROM student_enrollments WHERE id = ?'
);
$missingEnrollmentCheck->execute([$rollbackEnrollmentId]);

if ((int)$missingEnrollmentCheck->fetchColumn() !== 0) {
    fail_acceptance('Rollback probe could not remove its isolated target enrollment.');
}

$beforeRollbackCommit = production_counts($pdo);
create_rollback_trigger($pdo);

$rollbackFailed = false;
try {
    $reconciliation->commit($rollbackBatchId, $adminUserId);
} catch (Throwable $e) {
    $rollbackFailed = true;
    info_acceptance('Rollback probe commit failed as intentionally injected.');
} finally {
    drop_rollback_trigger($pdo);
}

if (!$rollbackFailed) {
    fail_acceptance('Rollback probe unexpectedly committed successfully.');
}

$afterRollback = production_counts($pdo);
assert_same_counts(
    $beforeRollbackCommit,
    $afterRollback,
    'Real commit rollback probe'
);

$enrollmentStillMissing = $missingEnrollmentCheck;
$enrollmentStillMissing->execute([$rollbackEnrollmentId]);

if ((int)$enrollmentStillMissing->fetchColumn() !== 0) {
    fail_acceptance(
        'Rollback probe did not restore the isolated pre-commit state; the deleted enrollment reappeared.'
    );
}

assert_batch_counts($pdo, $rollbackBatchId, 27, 921, 'validated');

$rollbackImportedRows = $pdo->prepare(
    'SELECT COUNT(*)
     FROM school_import_rows r
     INNER JOIN school_import_classes c ON c.id = r.import_class_id
     WHERE c.batch_id = ?
       AND r.status = \'imported\''
);
$rollbackImportedRows->execute([$rollbackBatchId]);

if ((int)$rollbackImportedRows->fetchColumn() !== 0) {
    fail_acceptance('Rollback probe marked staging rows as imported despite transaction failure.');
}

pass_acceptance('Real commit rollback: injected failure rolled back the transaction and preserved the pre-commit state.');

$recoveryBefore = production_counts($pdo);
$recovered = $reconciliation->commit($rollbackBatchId, $adminUserId);
$recoveryAfter = production_counts($pdo);

if (($recovered['already_imported'] ?? false) !== false) {
    fail_acceptance('Rollback-probe recovery commit was unexpectedly idempotent on first retry.');
}

if ($recoveryAfter['students'] !== $recoveryBefore['students']) {
    fail_acceptance('Rollback-probe recovery unexpectedly created a student.');
}

if ($recoveryAfter['enrollments'] !== $recoveryBefore['enrollments'] + 1) {
    fail_acceptance('Rollback-probe recovery did not recreate exactly one enrollment.');
}

assert_batch_counts($pdo, $rollbackBatchId, 27, 921, 'imported');
assert_imported_rows($pdo, $rollbackBatchId, 921);

$replayBefore = production_counts($pdo);
$replay = $reconciliation->commit($rollbackBatchId, $adminUserId);
$replayAfter = production_counts($pdo);

if (($replay['already_imported'] ?? false) !== true) {
    fail_acceptance('Rollback-probe recovery replay was not idempotent.');
}

assert_same_counts($replayBefore, $replayAfter, 'rollback-probe recovery replay');

pass_acceptance('Rollback recovery commit succeeded and recreated exactly the missing enrollment.');
pass_acceptance('Rollback-probe recovery replay is idempotent.');

$finalCounts = production_counts($pdo);

info_acceptance(sprintf(
    'Final isolated DB counts: students=%d, enrollments=%d.',
    $finalCounts['students'],
    $finalCounts['enrollments']
));

pass_acceptance('REAL SCHOOL IMPORT ACCEPTANCE PASSED.');
exit(0);
