<?php

declare(strict_types=1);

$host = getenv('SAMS_TEST_DB_HOST') ?: 'db';
$port = (int)(getenv('SAMS_TEST_DB_PORT') ?: 3306);
$db = getenv('SAMS_TEST_DB_NAME') ?: 'sams';
$user = getenv('SAMS_TEST_DB_USER') ?: 'root';
$pass = getenv('SAMS_TEST_DB_PASS') ?: 'root';

$adminPassword = getenv('SAMS_E2E_PASSWORD') ?: '';
$teacherPassword = getenv('SAMS_E2E_TEACHER_PASSWORD') ?: '';

if ($adminPassword === '' || $teacherPassword === '') {
    throw new RuntimeException('Missing SAMS_E2E_*_PASSWORD environment variables.');
}

$dsn = sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $host, $port);
$pdo = new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
]);

function execute_sql_file(PDO $pdo, string $path): void
{
    $sql = file_get_contents($path);
    if ($sql === false) {
        throw new RuntimeException("Unable to read {$path}.");
    }

    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    $statements = preg_split('/;\s*(?:\R|$)/', $sql, -1, PREG_SPLIT_NO_EMPTY);

    foreach ($statements as $statement) {
        if (trim($statement) !== '') {
            $pdo->exec($statement);
        }
    }
}

execute_sql_file($pdo, __DIR__ . '/../database/schema.sql');

if (!preg_match('/^[A-Za-z0-9_]+$/', $db)) {
    throw new RuntimeException('Invalid E2E database name.');
}
$pdo->exec('USE `' . $db . '`');

$pdo->beginTransaction();

try {
    $yearStmt = $pdo->prepare(
        'INSERT INTO academic_years (name, starts_on, ends_on, is_active)
         VALUES (?, ?, ?, 1)'
    );
    $yearStmt->execute(['2026/2027', '2026-09-01', '2027-07-31']);
    $academicYearId = (int)$pdo->lastInsertId();

    $userStmt = $pdo->prepare(
        'INSERT INTO users
            (username, employee_id, full_name, phone, password_hash, role, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)'
    );

    $userStmt->execute([
        'admin',
        null,
        'E2E Admin',
        null,
        password_hash($adminPassword, PASSWORD_DEFAULT),
        'admin',
    ]);
    $adminId = (int)$pdo->lastInsertId();

    $userStmt->execute([
        'teacher.e2e',
        'teacher.e2e',
        'E2E Teacher',
        null,
        password_hash($teacherPassword, PASSWORD_DEFAULT),
        'teacher',
    ]);
    $teacherId = (int)$pdo->lastInsertId();

    $classStmt = $pdo->prepare(
        'INSERT INTO classes (academic_year_id, name, level, branch)
         VALUES (?, ?, ?, ?)'
    );

    $classStmt->execute([$academicYearId, 'E2E-2BAC-A', '2BAC', 'SP']);
    $classA = (int)$pdo->lastInsertId();

    $classStmt->execute([$academicYearId, 'E2E-2BAC-B', '2BAC', 'SP']);
    $classB = (int)$pdo->lastInsertId();

    $subjectStmt = $pdo->prepare(
        'INSERT INTO subjects (code, name_fr, name_ar, name_en) VALUES (?, ?, ?, ?)'
    );
    $subjectStmt->execute(['MATH', 'Mathématiques', 'الرياضيات', 'Mathematics']);
    $mathSubjectId = (int)$pdo->lastInsertId();

    $assignmentStmt = $pdo->prepare(
        'INSERT INTO teacher_classes (teacher_id, class_id) VALUES (?, ?)'
    );
    $assignmentStmt->execute([$teacherId, $classA]);
    $signatureStmt = $pdo->prepare(
        'INSERT INTO signatures (teacher_id, class_id, signature_data, mime_type)
         VALUES (?, ?, ?, ?)'
    );
    $signatureStmt->execute([$teacherId, $classA, 'data:image/png;base64,E2E-SIGNATURE', 'image/png']);

    $teachingStmt = $pdo->prepare(
        'INSERT INTO teacher_teachings (teacher_id, subject_id, class_id) VALUES (?, ?, ?)'
    );
    $teachingStmt->execute([$teacherId, $mathSubjectId, $classA]);

    $studentStmt = $pdo->prepare(
        'INSERT INTO students
            (class_id, student_number, massar_code, birth_date, first_name, last_name)
         VALUES (?, ?, ?, ?, ?, ?)'
    );

    $enrollmentStmt = $pdo->prepare(
        'INSERT INTO student_enrollments
            (student_id, class_id, starts_on)
         VALUES (?, ?, ?)'
    );

    $studentsA = [
        ['A001', 'E2E001', '2010-05-12', 'Jean', 'Dupont'],
        ['A002', 'E2E002', '2010-06-20', 'Marie', 'Martin'],
        ['A003', 'E2E003', '2010-07-14', 'Youssef', 'Alaoui'],
    ];

    foreach ($studentsA as $student) {
        $studentStmt->execute([$classA, ...$student]);
        $studentId = (int)$pdo->lastInsertId();
        $enrollmentStmt->execute([$studentId, $classA, '2026-09-01']);
    }

    $studentStmt->execute([$classB, 'B001', 'E2E101', '2010-08-22', 'Sara', 'Bennani']);
    $studentBId = (int)$pdo->lastInsertId();
    $enrollmentStmt->execute([$studentBId, $classB, '2026-09-01']);

    $firstStudentId = (int)$pdo->query(
        "SELECT id FROM students WHERE massar_code = 'E2E001' LIMIT 1"
    )->fetchColumn();
    $firstEnrollmentId = (int)$pdo->query(
        'SELECT id FROM student_enrollments WHERE student_id = ' . $firstStudentId . ' AND class_id = ' . $classA . ' LIMIT 1'
    )->fetchColumn();

    $attendanceDate = date('Y-m-d');
    $attendanceStmt = $pdo->prepare(
        'INSERT INTO attendance
            (student_id, enrollment_id, attendance_date, period, status, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?)'
    );

    $statuses = ['present', 'absent', 'late', 'excused', 'present', 'absent', 'present', 'late'];
    foreach ($statuses as $period => $status) {
        $attendanceStmt->execute([
            $firstStudentId,
            $firstEnrollmentId,
            $attendanceDate,
            $period + 1,
            $status,
            $teacherId,
        ]);
    }

    $pdo->commit();

    echo "[PASS] E2E school bootstrap: admin={$adminId}, teacher={$teacherId}, classes={$classA},{$classB}" . PHP_EOL;
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}
