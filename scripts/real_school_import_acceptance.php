<?php

declare(strict_types=1);

require_once __DIR__ . '/../backend/vendor/autoload.php';

function acceptance_fail(string $message): never
{
    fwrite(STDERR, "[FAIL] {$message}" . PHP_EOL);
    exit(1);
}

function acceptance_pass(string $message): void
{
    fwrite(STDOUT, "[PASS] {$message}" . PHP_EOL);
}

function acceptance_info(string $message): void
{
    fwrite(STDOUT, "[INFO] {$message}" . PHP_EOL);
}

/**
 * @return array<string, mixed>
 */
function acceptance_database_config(): array
{
    $path = __DIR__ . '/../backend/config/database.php';

    if (!is_file($path)) {
        acceptance_fail(
            'Missing backend/config/database.php. Copy backend/config/database.example.php for the local acceptance environment.'
        );
    }

    $config = require $path;

    if (!is_array($config)) {
        acceptance_fail('Database configuration must return an array.');
    }

    return $config;
}

/**
 * @return array{students:int,enrollments:int}
 */
function acceptance_counts(\PDO $pdo): array
{
    return [
        'students' => (int)$pdo->query('SELECT COUNT(*) FROM students')->fetchColumn(),
        'enrollments' => (int)$pdo->query('SELECT COUNT(*) FROM student_enrollments')->fetchColumn(),
    ];
}

function acceptance_normalize_text(mixed $value): string
{
    return trim((string)($value ?? ''));
}

function acceptance_normalize_identity(mixed $value): string
{
    $value = acceptance_normalize_text($value);

    return strtolower(preg_replace('/\s+/u', ' ', $value) ?? $value);
}

function acceptance_normalize_year(mixed $value): string
{
    return str_replace('/', '-', acceptance_normalize_text($value));
}

/**
 * @param array<string,mixed> $validated
 * @return array{classes:list<array<string,mixed>>,rows:list<list<array<string,mixed>>>}
 */
function acceptance_source_snapshot(array $validated): array
{
    $classes = is_array($validated['classes'] ?? null) ? $validated['classes'] : [];
    $classSnapshots = [];
    $rowSnapshots = [];

    foreach ($classes as $class) {
        $classSnapshots[] = [
            'source_sheet' => acceptance_normalize_text($class['source_sheet'] ?? null),
            'class_name' => acceptance_normalize_text($class['class_name'] ?? null),
            'level' => acceptance_normalize_text($class['level'] ?? null),
            'academic_year' => acceptance_normalize_text($class['academic_year'] ?? null),
            'student_count' => count(
                is_array($class['students'] ?? null) ? $class['students'] : []
            ),
        ];

        $rows = [];

        foreach (($class['students'] ?? []) as $student) {
            $rows[] = [
                'roster_number' => acceptance_normalize_text($student['roster_number'] ?? null),
                'massar_code' => acceptance_normalize_text($student['massar_code'] ?? null),
                'first_name' => acceptance_normalize_text($student['first_name'] ?? null),
                'last_name' => acceptance_normalize_text($student['last_name'] ?? null),
                'birth_date' => acceptance_normalize_text($student['birth_date'] ?? null),
                'sex' => acceptance_normalize_text($student['sex'] ?? null),
                'birth_place' => acceptance_normalize_text($student['birth_place'] ?? null),
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
 * @param array{classes:list<array<string,mixed>>,rows:list<list<array<string,mixed>>>} $left
 * @param array{classes:list<array<string,mixed>>,rows:list<list<array<string,mixed>>>} $right
 * @return array{errors:list<string>,whitespace_last_name_deltas:int,birth_place_presence_deltas:int}
 */
function acceptance_compare_snapshots(array $left, array $right): array
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

        foreach (
            ['source_sheet', 'class_name', 'level', 'academic_year', 'student_count']
            as $field
        ) {
            $leftValue = $leftClass[$field] ?? null;
            $rightValue = $rightClass[$field] ?? null;

            if ($field === 'academic_year') {
                if (
                    acceptance_normalize_year($leftValue)
                    !== acceptance_normalize_year($rightValue)
                ) {
                    $errors[] = "class {$classIndex} academic_year mismatch";
                }

                continue;
            }

            if ((string)$leftValue !== (string)$rightValue) {
                $errors[] = "class {$classIndex} {$field} mismatch";
            }
        }

        $leftRows = $left['rows'][$classIndex] ?? [];
        $rightRows = $right['rows'][$classIndex] ?? [];

        if (count($leftRows) !== count($rightRows)) {
            $errors[] = sprintf(
                'class %d row count mismatch: %d vs %d',
                $classIndex,
                count($leftRows),
                count($rightRows)
            );
        }

        $rowCount = min(count($leftRows), count($rightRows));

        for ($rowIndex = 0; $rowIndex < $rowCount; ++$rowIndex) {
            $leftRow = $leftRows[$rowIndex];
            $rightRow = $rightRows[$rowIndex];

            foreach (
                ['roster_number', 'massar_code', 'first_name', 'birth_date', 'sex']
                as $field
            ) {
                if ((string)($leftRow[$field] ?? '') !== (string)($rightRow[$field] ?? '')) {
                    $errors[] = "class {$classIndex} row {$rowIndex} {$field} mismatch";
                }
            }

            if ((string)($leftRow['last_name'] ?? '') !== (string)($rightRow['last_name'] ?? '')) {
                if (
                    acceptance_normalize_identity($leftRow['last_name'] ?? '')
                    === acceptance_normalize_identity($rightRow['last_name'] ?? '')
                ) {
                    ++$whitespaceLastNameDeltas;
                } else {
                    $errors[] = "class {$classIndex} row {$rowIndex} last_name mismatch";
                }
            }

            if ((string)($leftRow['birth_place'] ?? '') !== (string)($rightRow['birth_place'] ?? '')) {
                $leftBlank = acceptance_normalize_text($leftRow['birth_place'] ?? '') === '';
                $rightBlank = acceptance_normalize_text($rightRow['birth_place'] ?? '') === '';

                if ($leftBlank xor $rightBlank) {
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
function acceptance_staged_snapshot(array $classes, array $rows): array
{
    $classIndexById = [];
    $classSnapshots = [];

    foreach ($classes as $index => $class) {
        $classId = (int)$class['id'];
        $classIndexById[$classId] = $index;

        $classSnapshots[] = [
            'source_sheet' => acceptance_normalize_text($class['source_sheet'] ?? null),
            'class_name' => acceptance_normalize_text($class['source_class_name'] ?? null),
            'level' => acceptance_normalize_text($class['source_level'] ?? null),
            'academic_year' => acceptance_normalize_text($class['source_academic_year'] ?? null),
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
            'roster_number' => acceptance_normalize_text($row['roster_number'] ?? null),
            'massar_code' => acceptance_normalize_text($row['massar_code'] ?? null),
            'first_name' => acceptance_normalize_text($row['first_name'] ?? null),
            'last_name' => acceptance_normalize_text($row['last_name'] ?? null),
            'birth_date' => acceptance_normalize_text($row['birth_date'] ?? null),
            'sex' => acceptance_normalize_text($row['sex'] ?? null),
            'birth_place' => acceptance_normalize_text($row['birth_place'] ?? null),
        ];
    }

    return [
        'classes' => $classSnapshots,
        'rows' => $rowSnapshots,
    ];
}

function acceptance_assert_same_counts(
    array $expected,
    array $actual,
    string $context
): void {
    if ($expected !== $actual) {
        acceptance_fail(
            sprintf(
                '%s changed production counts: before=%s after=%s',
                $context,
                json_encode($expected, JSON_THROW_ON_ERROR),
                json_encode($actual, JSON_THROW_ON_ERROR)
            )
        );
    }
}

function acceptance_assert_batch(
    \PDO $pdo,
    int $batchId,
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
        acceptance_fail("Batch {$batchId} does not exist.");
    }

    if (
        (string)$batch['status'] !== $expectedStatus
        || (int)$batch['total_classes'] !== 27
        || (int)$batch['total_rows'] !== 921
    ) {
        acceptance_fail(
            "Batch {$batchId} has unexpected state: "
            . json_encode($batch, JSON_THROW_ON_ERROR)
        );
    }
}

function acceptance_assert_imported_rows(
    \PDO $pdo,
    int $batchId,
    int $expected
): void {
    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM school_import_rows r
         INNER JOIN school_import_classes c ON c.id = r.import_class_id
         WHERE c.batch_id = ?
           AND r.status = \'imported\''
    );
    $stmt->execute([$batchId]);

    $actual = (int)$stmt->fetchColumn();

    if ($actual !== $expected) {
        acceptance_fail(
            "Batch {$batchId} has {$actual} imported rows; expected {$expected}."
        );
    }
}

function acceptance_create_rollback_trigger(\PDO $pdo): void
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

function acceptance_drop_rollback_trigger(\PDO $pdo): void
{
    $pdo->exec('DROP TRIGGER IF EXISTS sams_real_acceptance_fail_import');
}

$config = acceptance_database_config();

if (getenv('SAMS_REAL_ACCEPTANCE') !== '1') {
    acceptance_fail('This harness is manual-only. Set SAMS_REAL_ACCEPTANCE=1 explicitly.');
}

$databaseName = (string)($config['database'] ?? '');

if (!preg_match('/(?:^|_)(?:acceptance|staging)(?:_|$)/i', $databaseName)) {
    acceptance_fail(
        "Refusing database '{$databaseName}'. Use an isolated _acceptance or _staging database."
    );
}

if ($databaseName === 'sams' || preg_match('/prod|production/i', $databaseName)) {
    acceptance_fail("Refusing non-isolated database '{$databaseName}'.");
}

if ($argc < 4) {
    acceptance_fail(
        'Usage: php scripts/real_school_import_acceptance.php <real.xlsx> <real.md> <target_academic_year_id> [admin_user_id]'
    );
}

$xlsxPath = realpath($argv[1]);
$mdPath = realpath($argv[2]);

$targetAcademicYearId = filter_var(
    $argv[3],
    FILTER_VALIDATE_INT
);

$adminUserId = isset($argv[4])
    ? filter_var($argv[4], FILTER_VALIDATE_INT)
    : null;

if ($xlsxPath === false || !is_file($xlsxPath)) {
    acceptance_fail('Real XLSX path does not exist.');
}

if ($mdPath === false || !is_file($mdPath)) {
    acceptance_fail('Real Markdown path does not exist.');
}

if (strtolower(pathinfo($xlsxPath, PATHINFO_EXTENSION)) !== 'xlsx') {
    acceptance_fail('First input must use the .xlsx extension.');
}

if (strtolower(pathinfo($mdPath, PATHINFO_EXTENSION)) !== 'md') {
    acceptance_fail('Second input must use the .md extension.');
}

if ($targetAcademicYearId === false || $targetAcademicYearId < 1) {
    acceptance_fail('Target academic year id must be a positive integer.');
}

try {
    $pdo = \SAMS\Helpers\Database::connection();

    if ($adminUserId === null || $adminUserId === false || $adminUserId < 1) {
        $adminUserId = (int)$pdo->query(
            "SELECT id
             FROM users
             WHERE role = 'admin'
               AND is_active = 1
             ORDER BY id
             LIMIT 1"
        )->fetchColumn();
    }

    if ($adminUserId < 1) {
        acceptance_fail('No active admin user exists in the isolated database.');
    }

    $adminSchoolId = (int)$pdo->query(
        "SELECT school_id FROM users WHERE id = {$adminUserId} LIMIT 1"
    )->fetchColumn();

    if ($adminSchoolId < 1) {
        acceptance_fail('Selected admin user has no school ownership.');
    }

    $targetYearStmt = $pdo->prepare(
        'SELECT id, school_id, name, starts_on, ends_on, is_active
         FROM academic_years
         WHERE id = ?
         LIMIT 1'
    );
    $targetYearStmt->execute([$targetAcademicYearId]);
    $targetYear = $targetYearStmt->fetch();

    if (!is_array($targetYear)) {
        acceptance_fail(
            "Target academic year {$targetAcademicYearId} does not exist."
        );
    }

    if ((int)($targetYear['school_id'] ?? 0) !== $adminSchoolId) {
        acceptance_fail('Target academic year does not belong to the selected admin school.');
    }

    $initialCounts = acceptance_counts($pdo);

    if ($initialCounts !== ['students' => 0, 'enrollments' => 0]) {
        acceptance_fail(
            'Acceptance database is not clean. Expected 0 students and 0 enrollments before the real import.'
        );
    }

    $xlsxHash = hash_file('sha256', $xlsxPath);
    $mdHash = hash_file('sha256', $mdPath);

    if ($xlsxHash === false || $mdHash === false) {
        acceptance_fail('Unable to fingerprint the real source files.');
    }

    acceptance_info("isolated database: {$databaseName}");
    acceptance_info("target academic year: {$targetYear['name']} (#{$targetAcademicYearId})");
    acceptance_info("xlsx sha256: {$xlsxHash}");
    acceptance_info("md sha256:   {$mdHash}");

    $parser = new \SAMS\Services\SchoolWorkbookImportService();
    $validator = new \SAMS\Services\SchoolWorkbookImportValidationService();

    $xlsxParsed = $parser->parse($xlsxPath, basename($xlsxPath));
    $xlsxValidated = $validator->validate($xlsxParsed);

    $mdParsed = $parser->parse($mdPath, basename($mdPath));
    $mdValidated = $validator->validate($mdParsed);

    if (($xlsxValidated['valid'] ?? false) !== true) {
        acceptance_fail('Real XLSX failed parser validation.');
    }

    if (($mdValidated['valid'] ?? false) !== true) {
        acceptance_fail('Real Markdown failed parser validation.');
    }

    $expectedShape = static function (array $validated, string $label): void {
        $classCount = (int)($validated['summary']['class_count'] ?? -1);
        $studentCount = (int)($validated['summary']['student_count'] ?? -1);

        if ($classCount !== 27 || $studentCount !== 921) {
            acceptance_fail(
                "{$label} shape is not 27 classes / 921 rows: got {$classCount} / {$studentCount}."
            );
        }
    };

    $expectedShape($xlsxValidated, 'Real XLSX');
    $expectedShape($mdValidated, 'Real Markdown');

    $sourceYears = [];
    foreach (($xlsxValidated['classes'] ?? []) as $class) {
        $year = acceptance_normalize_text($class['academic_year'] ?? null);

        if ($year !== '') {
            $sourceYears[$year] = true;
        }
    }

    if (count($sourceYears) !== 1) {
        acceptance_fail('Real XLSX does not contain exactly one source academic year.');
    }

    $sourceYear = array_key_first($sourceYears);

    if (
        acceptance_normalize_year($sourceYear)
        !== acceptance_normalize_year($targetYear['name'])
    ) {
        acceptance_fail(
            sprintf(
                'Source academic year %s does not match target year %s.',
                $sourceYear,
                $targetYear['name']
            )
        );
    }

    $directComparison = acceptance_compare_snapshots(
        acceptance_source_snapshot($xlsxValidated),
        acceptance_source_snapshot($mdValidated)
    );

    if ($directComparison['errors'] !== []) {
        acceptance_fail(
            'Real XLSX vs Markdown semantic equivalence failed: '
            . implode('; ', $directComparison['errors'])
        );
    }

    if ($directComparison['whitespace_last_name_deltas'] !== 1) {
        acceptance_fail(
            'Expected exactly 1 whitespace-only last-name representation delta; got '
            . $directComparison['whitespace_last_name_deltas']
            . '.'
        );
    }

    if ($directComparison['birth_place_presence_deltas'] !== 0) {
        acceptance_fail(
            'Expected 0 birth-place presence deltas after parser normalization; got '
            . $directComparison['birth_place_presence_deltas']
            . '.'
        );
    }

    acceptance_pass('Real XLSX parser validation: 27 classes / 921 rows.');
    acceptance_pass('Real Markdown parser validation: 27 classes / 921 rows.');
    acceptance_pass(
        'Real XLSX ↔ Markdown semantic equivalence: PASS (0 birth-place deltas after NaN normalization + 1 whitespace-only last-name delta).'
    );

    $staging = new \SAMS\Services\SchoolWorkbookImportStagingService();
    $reconciliation = new \SAMS\Services\SchoolWorkbookImportReconciliationService();
    $imports = new \SAMS\Repositories\SchoolImportRepository();

    $beforeStaging = acceptance_counts($pdo);

    $xlsxStaged = $staging->stage(
        $xlsxPath,
        $adminUserId,
        basename($xlsxPath),
        $targetAcademicYearId
    , $adminSchoolId);

    if (($xlsxStaged['status'] ?? '') !== 'validated') {
        acceptance_fail('Real XLSX did not reach validated staging state.');
    }

    $mdStaged = $staging->stage(
        $mdPath,
        $adminUserId,
        basename($mdPath),
        $targetAcademicYearId
    , $adminSchoolId);

    if (($mdStaged['status'] ?? '') !== 'validated') {
        acceptance_fail('Real Markdown did not reach validated staging state.');
    }

    acceptance_assert_same_counts(
        $beforeStaging,
        acceptance_counts($pdo),
        'Real source staging'
    );

    if (
        (int)($xlsxStaged['summary']['class_count'] ?? -1) !== 27
        || (int)($xlsxStaged['summary']['student_count'] ?? -1) !== 921
        || (int)($mdStaged['summary']['class_count'] ?? -1) !== 27
        || (int)($mdStaged['summary']['student_count'] ?? -1) !== 921
    ) {
        acceptance_fail('Staging summaries are not 27 classes / 921 rows for both sources.');
    }

    $xlsxBatchId = (int)$xlsxStaged['batch_id'];
    $mdBatchId = (int)$mdStaged['batch_id'];

    $xlsxStored = acceptance_staged_snapshot(
        $imports->classesForBatch($xlsxBatchId),
        $imports->rowsForBatch($xlsxBatchId)
    );
    $mdStored = acceptance_staged_snapshot(
        $imports->classesForBatch($mdBatchId),
        $imports->rowsForBatch($mdBatchId)
    );

    $stagedComparison = acceptance_compare_snapshots($xlsxStored, $mdStored);

    if ($stagedComparison['errors'] !== []) {
        acceptance_fail(
            'Real XLSX vs Markdown staging equivalence failed: '
            . implode('; ', $stagedComparison['errors'])
        );
    }

    if (
        $stagedComparison['whitespace_last_name_deltas']
        !== $directComparison['whitespace_last_name_deltas']
        || $stagedComparison['birth_place_presence_deltas']
        !== $directComparison['birth_place_presence_deltas']
    ) {
        acceptance_fail('Staging representation deltas differ from direct parser comparison.');
    }

    acceptance_assert_batch($pdo, $xlsxBatchId, 'validated');
    acceptance_assert_batch($pdo, $mdBatchId, 'validated');

    acceptance_pass("Real XLSX staged successfully as batch {$xlsxBatchId}.");
    acceptance_pass("Real Markdown staged successfully as batch {$mdBatchId}.");
    acceptance_pass('Real staging preserved 0 student/enrollment production changes.');
    acceptance_pass('Stored staging snapshots match the direct source comparison.');

    $beforeReconcile = acceptance_counts($pdo);

    $xlsxReconciled = $reconciliation->reconcile(
        $xlsxBatchId,
        $adminUserId
    , $adminSchoolId);

    acceptance_assert_same_counts(
        $beforeReconcile,
        acceptance_counts($pdo),
        'Real XLSX reconciliation'
    );

    if (($xlsxReconciled['ready_to_import'] ?? false) !== true) {
        acceptance_fail('Real XLSX reconciliation did not become ready_to_import.');
    }

    $reconcileSummary = $xlsxReconciled['summary'] ?? [];

    if (
        (int)($reconcileSummary['class_count'] ?? -1) !== 27
        || (int)($reconcileSummary['mapped_classes'] ?? -1) !== 27
        || (int)($reconcileSummary['conflict_rows'] ?? -1) !== 0
        || (
            (int)($reconcileSummary['new_students'] ?? 0)
            + (int)($reconcileSummary['existing_students'] ?? 0)
        ) !== 921
    ) {
        acceptance_fail(
            'Real XLSX reconciliation summary is inconsistent with 27 classes / 921 students.'
        );
    }

    $newStudents = (int)$reconcileSummary['new_students'];
    $existingStudents = (int)$reconcileSummary['existing_students'];

    if ($initialCounts['students'] === 0 && $existingStudents !== 0) {
        acceptance_fail(
            "Clean acceptance DB unexpectedly reconciled {$existingStudents} existing students."
        );
    }

    acceptance_pass(
        sprintf(
            'Real XLSX reconciliation: 27/27 classes mapped, 0 conflicts, %d new + %d existing students.',
            $newStudents,
            $existingStudents
        )
    );

    $beforeCommit = acceptance_counts($pdo);

    $xlsxCommitted = $reconciliation->commit(
        $xlsxBatchId,
        $adminUserId
    , $adminSchoolId);

    $afterFirstCommit = acceptance_counts($pdo);

    if (($xlsxCommitted['already_imported'] ?? false) !== false) {
        acceptance_fail('First real XLSX commit was incorrectly treated as already imported.');
    }

    $studentDelta = $afterFirstCommit['students'] - $beforeCommit['students'];
    $enrollmentDelta = $afterFirstCommit['enrollments'] - $beforeCommit['enrollments'];

    if ($studentDelta !== $newStudents) {
        acceptance_fail(
            "First commit created {$studentDelta} students; reconciliation expected {$newStudents}."
        );
    }

    if ($enrollmentDelta !== (int)($xlsxCommitted['summary']['enrollments_created'] ?? -1)) {
        acceptance_fail('First commit enrollment delta does not match its commit summary.');
    }

    if (
        $afterFirstCommit['students'] !== 921
        || $afterFirstCommit['enrollments'] !== 921
    ) {
        acceptance_fail(
            sprintf(
                'First real XLSX commit did not produce 921 students / 921 enrollments: got %d / %d.',
                $afterFirstCommit['students'],
                $afterFirstCommit['enrollments']
            )
        );
    }

    acceptance_assert_batch($pdo, $xlsxBatchId, 'imported');
    acceptance_assert_imported_rows($pdo, $xlsxBatchId, 921);

    acceptance_pass(
        sprintf(
            'Real XLSX atomic commit: +%d students / +%d enrollments.',
            $studentDelta,
            $enrollmentDelta
        )
    );

    $secondCommit = $reconciliation->commit(
        $xlsxBatchId,
        $adminUserId
    , $adminSchoolId);

    if (($secondCommit['already_imported'] ?? false) !== true) {
        acceptance_fail('Second real XLSX commit was not idempotent.');
    }

    acceptance_assert_same_counts(
        $afterFirstCommit,
        acceptance_counts($pdo),
        'Real XLSX idempotent replay'
    );

    acceptance_pass('Real XLSX second commit is idempotent; no duplicates were created.');

    $rollbackStaged = $staging->stage(
        $xlsxPath,
        $adminUserId,
        basename($xlsxPath) . '.rollback-probe.xlsx',
        $targetAcademicYearId
    , $adminSchoolId);

    if (($rollbackStaged['status'] ?? '') !== 'validated') {
        acceptance_fail('Rollback-probe XLSX did not reach validated staging state.');
    }

    $rollbackBatchId = (int)$rollbackStaged['batch_id'];

    $rollbackReconciled = $reconciliation->reconcile(
        $rollbackBatchId,
        $adminUserId
    , $adminSchoolId);

    if (($rollbackReconciled['ready_to_import'] ?? false) !== true) {
        acceptance_fail('Rollback-probe XLSX reconciliation did not become ready_to_import.');
    }

    $rollbackEnrollmentStmt = $pdo->query(
        "SELECT r.target_enrollment_id
         FROM school_import_rows r
         INNER JOIN school_import_classes c ON c.id = r.import_class_id
         WHERE c.batch_id = {$rollbackBatchId}
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
        acceptance_fail(
            'Rollback probe could not find an attendance-free target-year enrollment.'
        );
    }

    $attendanceCheck = $pdo->prepare(
        'SELECT COUNT(*) FROM attendance WHERE enrollment_id = ?'
    );
    $attendanceCheck->execute([$rollbackEnrollmentId]);

    if ((int)$attendanceCheck->fetchColumn() !== 0) {
        acceptance_fail('Rollback probe selected an enrollment that has attendance rows.');
    }

    $pdo->prepare(
        'DELETE FROM student_enrollments WHERE id = ?'
    )->execute([$rollbackEnrollmentId]);

    $missingEnrollmentCheck = $pdo->prepare(
        'SELECT COUNT(*) FROM student_enrollments WHERE id = ?'
    );
    $missingEnrollmentCheck->execute([$rollbackEnrollmentId]);

    if ((int)$missingEnrollmentCheck->fetchColumn() !== 0) {
        acceptance_fail('Rollback probe failed to remove the isolated target enrollment.');
    }

    $beforeRollbackCommit = acceptance_counts($pdo);

    acceptance_create_rollback_trigger($pdo);

    $rollbackFailed = false;

    try {
        $reconciliation->commit(
            $rollbackBatchId,
            $adminUserId
        , $adminSchoolId);
    } catch (\Throwable) {
        $rollbackFailed = true;
    } finally {
        acceptance_drop_rollback_trigger($pdo);
    }

    if (!$rollbackFailed) {
        acceptance_fail('Rollback probe unexpectedly committed successfully.');
    }

    acceptance_assert_same_counts(
        $beforeRollbackCommit,
        acceptance_counts($pdo),
        'Real atomic rollback probe'
    );

    $missingEnrollmentCheck->execute([$rollbackEnrollmentId]);

    if ((int)$missingEnrollmentCheck->fetchColumn() !== 0) {
        acceptance_fail(
            'Rollback probe restored a row that was deleted before the transaction.'
        );
    }

    acceptance_assert_batch($pdo, $rollbackBatchId, 'validated');
    acceptance_assert_imported_rows($pdo, $rollbackBatchId, 0);

    acceptance_pass(
        'Real atomic rollback: injected commit failure rolled back all transactional import changes.'
    );

    $beforeRecovery = acceptance_counts($pdo);

    $recovered = $reconciliation->commit(
        $rollbackBatchId,
        $adminUserId
    , $adminSchoolId);

    $afterRecovery = acceptance_counts($pdo);

    if (($recovered['already_imported'] ?? false) !== false) {
        acceptance_fail('Rollback recovery was unexpectedly treated as already imported.');
    }

    if ($afterRecovery['students'] !== $beforeRecovery['students']) {
        acceptance_fail('Rollback recovery unexpectedly created a new student.');
    }

    if ($afterRecovery['enrollments'] !== $beforeRecovery['enrollments'] + 1) {
        acceptance_fail('Rollback recovery did not recreate exactly one enrollment.');
    }

    acceptance_assert_batch($pdo, $rollbackBatchId, 'imported');
    acceptance_assert_imported_rows($pdo, $rollbackBatchId, 921);

    acceptance_pass(
        'Rollback recovery recreated exactly the missing enrollment and completed the import.'
    );

    $beforeRecoveryReplay = acceptance_counts($pdo);

    $recoveryReplay = $reconciliation->commit(
        $rollbackBatchId,
        $adminUserId
    , $adminSchoolId);

    if (($recoveryReplay['already_imported'] ?? false) !== true) {
        acceptance_fail('Rollback recovery replay was not idempotent.');
    }

    acceptance_assert_same_counts(
        $beforeRecoveryReplay,
        acceptance_counts($pdo),
        'Rollback recovery idempotent replay'
    );

    acceptance_pass('Rollback recovery replay is idempotent.');

    $finalCounts = acceptance_counts($pdo);

    if (
        $finalCounts['students'] !== 921
        || $finalCounts['enrollments'] !== 921
    ) {
        acceptance_fail(
            sprintf(
                'Final isolated DB counts are unexpected: students=%d, enrollments=%d.',
                $finalCounts['students'],
                $finalCounts['enrollments']
            )
        );
    }

    acceptance_info(
        sprintf(
            'Final isolated DB counts: students=%d, enrollments=%d.',
            $finalCounts['students'],
            $finalCounts['enrollments']
        )
    );

    acceptance_pass('REAL SCHOOL IMPORT ACCEPTANCE PASSED.');
} catch (\Throwable $e) {
    acceptance_fail(
        'Unhandled acceptance failure: '
        . get_class($e)
        . ': '
        . $e->getMessage()
    );
}
