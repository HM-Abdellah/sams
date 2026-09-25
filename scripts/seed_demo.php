<?php

declare(strict_types=1);

/**
 * SAMS local/demo bootstrap.
 *
 * Run only against a development/demo database:
 *   php scripts/seed_demo.php
 *
 * Demo credentials are intentionally non-production credentials.
 * Never use these accounts or this script on a real school database.
 */

require_once __DIR__ . '/../app/Helpers/Database.php';

use SAMS\Helpers\Database;

const DEMO_ADMIN_USERNAME = 'admin.demo';
const DEMO_ADMIN_PASSWORD = 'SAMS-Demo-Admin-2026!';
const DEMO_TEACHER_USERNAME = 'teacher.demo';
const DEMO_TEACHER_PASSWORD = 'SAMS-Demo-Teacher-2026!';

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script must be executed from the command line.\n");
    exit(1);
}

function upsert_user(PDO $pdo, string $username, string $fullName, string $password, string $role): int
{
    $stmt = $pdo->prepare(
        'INSERT INTO users (username, full_name, password_hash, role, is_active)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
            full_name = VALUES(full_name),
            password_hash = VALUES(password_hash),
            role = VALUES(role),
            is_active = 1,
            failed_login_attempts = 0,
            locked_until = NULL'
    );

    $stmt->execute([
        $username,
        $fullName,
        password_hash($password, PASSWORD_DEFAULT),
        $role,
    ]);

    $idStmt = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
    $idStmt->execute([$username]);
    return (int)$idStmt->fetchColumn();
}

function ensure_class(PDO $pdo, int $academicYearId, string $name, string $level, string $branch): int
{
    $find = $pdo->prepare(
        'SELECT id
         FROM classes
         WHERE academic_year_id = ? AND name = ?
         LIMIT 1'
    );
    $find->execute([$academicYearId, $name]);
    $id = $find->fetchColumn();

    if ($id !== false) {
        return (int)$id;
    }

    $create = $pdo->prepare(
        'INSERT INTO classes (academic_year_id, name, level, branch, is_active)
         VALUES (?, ?, ?, ?, 1)'
    );
    $create->execute([$academicYearId, $name, $level, $branch]);

    return (int)$pdo->lastInsertId();
}

function ensure_student(PDO $pdo, int $classId, array $student, string $startsOn, ?string $endsOn = null): int
{
    $find = $pdo->prepare(
        'SELECT id
         FROM students
         WHERE massar_code = ?
         LIMIT 1'
    );
    $find->execute([$student['massar_code']]);
    $existingId = $find->fetchColumn();

    if ($existingId !== false) {
        $studentId = (int)$existingId;
        $update = $pdo->prepare(
            'UPDATE students
             SET class_id = ?, student_number = ?, birth_date = ?, first_name = ?, last_name = ?, status = \'active\'
             WHERE id = ?'
        );
        $update->execute([
            $classId,
            $student['student_number'],
            $student['birth_date'],
            $student['first_name'],
            $student['last_name'],
            $studentId,
        ]);
    } else {
        $insert = $pdo->prepare(
            'INSERT INTO students
                (class_id, student_number, massar_code, birth_date, first_name, last_name, status)
             VALUES (?, ?, ?, ?, ?, ?, \'active\')'
        );
        $insert->execute([
            $classId,
            $student['student_number'],
            $student['massar_code'],
            $student['birth_date'],
            $student['first_name'],
            $student['last_name'],
        ]);
        $studentId = (int)$pdo->lastInsertId();
    }

    $enrollment = $pdo->prepare(
        'SELECT id
         FROM student_enrollments
         WHERE student_id = ? AND starts_on = ?
         LIMIT 1'
    );
    $enrollment->execute([$studentId, $startsOn]);

    if ($enrollment->fetchColumn() === false) {
        $createEnrollment = $pdo->prepare(
            'INSERT INTO student_enrollments
                (student_id, class_id, starts_on, ends_on)
             VALUES (?, ?, ?, ?)'
        );
        $createEnrollment->execute([$studentId, $classId, $startsOn, $endsOn]);
    }

    return $studentId;
}

try {
    $pdo = Database::connection();

    $tableCheck = $pdo->query("SHOW TABLES LIKE 'academic_years'");
    if ($tableCheck->fetchColumn() === false) {
        throw new RuntimeException(
            "SAMS schema is missing. Import database/schema.sql first."
        );
    }

    $pdo->beginTransaction();

    $yearStmt = $pdo->prepare(
        'SELECT id
         FROM academic_years
         WHERE name = ?
         LIMIT 1'
    );
    $yearStmt->execute(['2026/2027']);
    $academicYearId = $yearStmt->fetchColumn();

    if ($academicYearId === false) {
        $createYear = $pdo->prepare(
            'INSERT INTO academic_years (name, starts_on, ends_on, is_active)
             VALUES (?, ?, ?, 1)'
        );
        $createYear->execute(['2026/2027', '2026-09-01', '2027-07-31']);
        $academicYearId = (int)$pdo->lastInsertId();
    } else {
        $academicYearId = (int)$academicYearId;
        $deactivateYears = $pdo->prepare(
            'UPDATE academic_years
             SET is_active = 0
             WHERE id <> ?'
        );
        $deactivateYears->execute([$academicYearId]);

        $activateYear = $pdo->prepare(
            'UPDATE academic_years
             SET starts_on = ?, ends_on = ?, is_active = 1
             WHERE id = ?'
        );
        $activateYear->execute(['2026-09-01', '2027-07-31', $academicYearId]);
    }

    $adminId = upsert_user(
        $pdo,
        DEMO_ADMIN_USERNAME,
        'SAMS Demo Administrator',
        DEMO_ADMIN_PASSWORD,
        'admin'
    );

    $teacherId = upsert_user(
        $pdo,
        DEMO_TEACHER_USERNAME,
        'SAMS Demo Teacher',
        DEMO_TEACHER_PASSWORD,
        'teacher'
    );

    $classA = ensure_class($pdo, $academicYearId, 'DEMO-2BAC-A', '2BAC', 'Sciences Physiques');
    $classB = ensure_class($pdo, $academicYearId, 'DEMO-2BAC-B', '2BAC', 'Sciences Physiques');

    $assign = $pdo->prepare(
        'INSERT IGNORE INTO teacher_classes (teacher_id, class_id)
         VALUES (?, ?)'
    );
    $assign->execute([$teacherId, $classA]);

    $students = [
        [$classA, [
            'student_number' => 'D001',
            'massar_code' => 'DEMO001',
            'birth_date' => '2010-05-12',
            'first_name' => 'Adam',
            'last_name' => 'Demo',
        ]],
        [$classA, [
            'student_number' => 'D002',
            'massar_code' => 'DEMO002',
            'birth_date' => '2010-06-20',
            'first_name' => 'Sara',
            'last_name' => 'Demo',
        ]],
        [$classA, [
            'student_number' => 'D003',
            'massar_code' => 'DEMO003',
            'birth_date' => '2010-07-14',
            'first_name' => 'Youssef',
            'last_name' => 'Demo',
        ]],
        [$classB, [
            'student_number' => 'D101',
            'massar_code' => 'DEMO101',
            'birth_date' => '2010-08-22',
            'first_name' => 'Lina',
            'last_name' => 'Demo',
        ]],
    ];

    $firstStudentId = null;
    foreach ($students as [$classId, $student]) {
        $studentId = ensure_student($pdo, $classId, $student, '2026-09-01');
        if ($firstStudentId === null && $classId === $classA) {
            $firstStudentId = $studentId;
        }
    }

    $pdo->commit();

    echo "[PASS] SAMS demo data is ready." . PHP_EOL;
    echo "Admin:   " . DEMO_ADMIN_USERNAME . " / " . DEMO_ADMIN_PASSWORD . PHP_EOL;
    echo "Teacher: " . DEMO_TEACHER_USERNAME . " / " . DEMO_TEACHER_PASSWORD . PHP_EOL;
    echo "Classes: DEMO-2BAC-A, DEMO-2BAC-B" . PHP_EOL;
    echo "Teacher assignment: DEMO-2BAC-A" . PHP_EOL;
    echo "Demo students: 4" . PHP_EOL;
    echo "Use these credentials only for local/demo testing." . PHP_EOL;
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, "[FAIL] Demo bootstrap: {$e->getMessage()}" . PHP_EOL);
    exit(1);
}
