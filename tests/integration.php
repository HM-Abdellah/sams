<?php

declare(strict_types=1);

$host = getenv('SAMS_TEST_DB_HOST') ?: '';
$port = getenv('SAMS_TEST_DB_PORT') ?: '3306';
$db   = getenv('SAMS_TEST_DB_NAME') ?: '';
$user = getenv('SAMS_TEST_DB_USER') ?: '';
$pass = getenv('SAMS_TEST_DB_PASS') ?: '';

if ($host === '' || $db === '' || $user === '') {
    fwrite(STDERR, "Missing SAMS_TEST_DB_* environment variables." . PHP_EOL);
    exit(2);
}

if (!preg_match('/^[A-Za-z0-9_]+$/', $db)) {
    throw new RuntimeException('Invalid integration database name.');
}

function expect_true(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function expect_db_reject(PDO $pdo, callable $callback, string $message): void
{
    try {
        $callback();
    } catch (PDOException) {
        return;
    }

    throw new RuntimeException($message);
}

function execute_schema(PDO $pdo, string $sql): void
{
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    $statements = preg_split('/;\s*(?:\R|$)/', $sql, -1, PREG_SPLIT_NO_EMPTY);

    foreach ($statements as $statement) {
        if (trim($statement) === '') {
            continue;
        }
        $pdo->exec($statement);
    }
}

$serverDsn = sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $host, (int)$port);
$pdo = new PDO($serverDsn, $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
]);

$schema = file_get_contents(__DIR__ . '/../database/schema.sql');
if ($schema === false) {
    throw new RuntimeException('Unable to read database/schema.sql.');
}

execute_schema($pdo, $schema);
execute_schema($pdo, $schema);

$tables = $pdo->query(
    "SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = " . $pdo->quote($db) . "
       AND TABLE_TYPE = 'BASE TABLE'"
)->fetchAll(PDO::FETCH_COLUMN);

$expectedTables = [
    'academic_years',
    'users',
    'classes',
    'teacher_classes',
    'subjects',
    'teacher_teachings',
    'students',
    'student_enrollments',
    'attendance',
    'attendance_signoffs',
    'attendance_week_signatures',
    'signatures',
    'audit_logs',
    'student_import_batches',
    'student_import_rows',
];

sort($tables);
sort($expectedTables);
expect_true($tables === $expectedTables, 'Fresh schema table set does not match expected schema.');

$pdo->exec("USE " . $db);

$pdo->exec(
    "INSERT INTO academic_years (name, starts_on, ends_on, is_active)
     VALUES ('2026-2027', '2026-09-01', '2027-07-31', 1)"
);

$pdo->exec(
    "INSERT INTO users (username, full_name, password_hash, role)
     VALUES
       ('admin', 'Integration Admin', 'hash-admin', 'admin'),
       ('teacher1', 'Integration Teacher', 'hash-teacher', 'teacher')"
);

$pdo->exec(
    "INSERT INTO classes (academic_year_id, name, level, branch)
     VALUES (1, '2BAC SP A', '2BAC', 'SP')"
);

$pdo->exec("INSERT INTO teacher_classes (teacher_id, class_id) VALUES (2, 1)");
$pdo->exec("INSERT INTO subjects (code, name_fr, name_ar, name_en) VALUES ('MATH', 'Mathématiques', 'الرياضيات', 'Mathematics')");
$pdo->exec("INSERT INTO teacher_teachings (teacher_id, subject_id, class_id) VALUES (2, 1, 1)");
expect_db_reject(
    $pdo,
    static fn() => $pdo->exec("INSERT INTO teacher_teachings (teacher_id, subject_id, class_id) VALUES (2, 1, 1)"),
    'Duplicate teacher teaching assignment was accepted.'
);

$pdo->exec(
    "INSERT INTO students
        (class_id, student_number, massar_code, birth_date, first_name, last_name)
     VALUES
        (1, 'ST001', 'MC001', '2010-05-12', 'Jean', 'Dupont')"
);

$pdo->exec(
    "INSERT INTO student_enrollments (student_id, class_id, starts_on)
     VALUES (1, 1, '2026-09-01')"
);

$pdo->exec(
    "INSERT INTO attendance
        (student_id, enrollment_id, attendance_date, period, status, recorded_by)
     VALUES
        (1, 1, '2026-09-25', 1, 'present', 2)"
);

expect_db_reject(
    $pdo,
    static fn() => $pdo->exec(
        "INSERT INTO attendance
            (student_id, enrollment_id, attendance_date, period, status, recorded_by)
         VALUES
            (1, 1, '2026-09-25', 1, 'absent', 2)"
    ),
    'Duplicate attendance row was accepted.'
);

expect_db_reject(
    $pdo,
    static fn() => $pdo->exec(
        "INSERT INTO attendance
            (student_id, enrollment_id, attendance_date, period, status, recorded_by)
         VALUES
            (1, 999999, '2026-09-25', 2, 'absent', 2)"
    ),
    'Attendance accepted a missing enrollment.'
);

expect_db_reject(
    $pdo,
    static fn() => $pdo->exec(
        "INSERT INTO students
            (class_id, student_number, massar_code, birth_date, first_name, last_name)
         VALUES
            (1, 'ST002', 'MC001', '2010-06-01', 'Marie', 'Dupont')"
    ),
    'Duplicate Massar code was accepted.'
);

expect_db_reject(
    $pdo,
    static fn() => $pdo->exec(
        "INSERT INTO students
            (class_id, student_number, massar_code, birth_date, first_name, last_name)
         VALUES
            (1, 'ST001', 'MC002', '2010-06-01', 'Marie', 'Dupont')"
    ),
    'Duplicate student number in the same class was accepted.'
);

expect_db_reject(
    $pdo,
    static fn() => $pdo->exec(
        "INSERT INTO attendance
            (student_id, enrollment_id, attendance_date, period, status, recorded_by)
         VALUES
            (1, 1, '2026-09-25', 9, 'present', 2)"
    ),
    'Invalid attendance period was accepted.'
);

$pdo->exec(
    "INSERT INTO signatures (teacher_id, class_id, signature_data, mime_type)
     VALUES (2, 1, 'data:image/png;base64,TEST', 'image/png')"
);

$pdo->exec(
    "INSERT INTO attendance_signoffs
        (class_id, teacher_id, attendance_date, period, signature_data)
     VALUES
        (1, 2, '2026-09-25', 1, 'data:image/png;base64,TEST')"
);

expect_db_reject(
    $pdo,
    static fn() => $pdo->exec(
        "INSERT INTO attendance_signoffs
            (class_id, teacher_id, attendance_date, period, signature_data)
         VALUES
            (1, 2, '2026-09-25', 1, 'data:image/png;base64,TEST2')"
    ),
    'Duplicate lesson sign-off was accepted.'
);

$pdo->exec(
    "INSERT INTO attendance_week_signatures
        (class_id, teacher_id, week_start, signature_data)
     VALUES
        (1, 2, '2026-09-21', 'data:image/png;base64,TEST')"
);

expect_db_reject(
    $pdo,
    static fn() => $pdo->exec(
        "INSERT INTO attendance_week_signatures
            (class_id, teacher_id, week_start, signature_data)
         VALUES
            (1, 2, '2026-09-21', 'data:image/png;base64,TEST2')"
    ),
    'Duplicate weekly signature was accepted.'
);

expect_db_reject(
    $pdo,
    static fn() => $pdo->exec(
        "INSERT INTO student_enrollments (student_id, class_id, starts_on, ends_on)
         VALUES (1, 1, '2027-01-01', '2026-12-31')"
    ),
    'Invalid enrollment date range was accepted.'
);

$pdo->exec(
    "INSERT INTO student_import_batches
        (class_id, created_by, original_filename, file_sha256, file_size)
     VALUES
        (1, 1, 'students.csv', REPEAT('a', 64), 128)"
);

$pdo->exec(
    "INSERT INTO student_import_rows
        (batch_id, `row_number`, first_name, last_name, massar_code, birth_date, status, raw_data)
     VALUES
        (1, 1, 'Imported', 'Student', 'MC002', '2010-01-01', 'valid', JSON_OBJECT('source', 'integration'))"
);

expect_true(
    (int)$pdo->query("SELECT COUNT(*) FROM student_import_rows WHERE batch_id = 1")->fetchColumn() === 1,
    'Import staging row was not persisted.'
);

$pdo->exec(
    "INSERT INTO classes (academic_year_id, name, level, branch)
     VALUES (1, '2BAC SP B', '2BAC', 'SP')"
);

$pdo->exec("INSERT INTO teacher_classes (teacher_id, class_id) VALUES (2, 2)");

$pdo->exec(
    "UPDATE student_enrollments
     SET ends_on = '2026-09-30'
     WHERE id = 1"
);

$pdo->exec(
    "INSERT INTO student_enrollments (student_id, class_id, starts_on)
     VALUES (1, 2, '2026-10-01')"
);

$pdo->exec("UPDATE students SET class_id = 2 WHERE id = 1");

$oldEnrollmentEnd = $pdo->query(
    "SELECT ends_on FROM student_enrollments WHERE id = 1"
)->fetchColumn();
expect_true(
    (string)$oldEnrollmentEnd === '2026-09-30',
    'Previous enrollment should end the day before transfer.'
);

$newEnrollmentStart = $pdo->query(
    "SELECT starts_on
     FROM student_enrollments
     WHERE student_id = 1 AND class_id = 2
     LIMIT 1"
)->fetchColumn();
expect_true(
    (string)$newEnrollmentStart === '2026-10-01',
    'New enrollment should start on the transfer effective date.'
);

$historical = $pdo->query(
    "SELECT COUNT(*)
     FROM attendance a
     INNER JOIN student_enrollments e ON e.id = a.enrollment_id
     WHERE a.student_id = 1
       AND a.attendance_date = '2026-09-25'
       AND e.class_id = 1"
)->fetchColumn();

expect_true((int)$historical === 1, 'Historical attendance must remain attached to the previous class.');

$currentClass = $pdo->query("SELECT class_id FROM students WHERE id = 1")->fetchColumn();
expect_true((int)$currentClass === 2, 'Student current class transfer should be reflected in students.class_id.');

$before = (int)$pdo->query("SELECT COUNT(*) FROM students")->fetchColumn();

$pdo->beginTransaction();
try {
    $pdo->exec(
        "INSERT INTO students
            (class_id, student_number, massar_code, birth_date, first_name, last_name)
         VALUES
            (1, 'ROLLBACK', 'MC-ROLLBACK', '2010-01-01', 'Rollback', 'Student')"
    );
    throw new RuntimeException('intentional rollback');
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
}

$after = (int)$pdo->query("SELECT COUNT(*) FROM students")->fetchColumn();
expect_true($before === $after, 'Transaction rollback did not restore student count.');

echo "[PASS] MariaDB integration constraints and rollback" . PHP_EOL;
