<?php

declare(strict_types=1);

require_once __DIR__ . '/../backend/src/bootstrap.php';

use SAMS\Helpers\Database;

$pdo = Database::connection();

$checks = [
    'multiple_active_academic_years' => [
        "SELECT school_id, COUNT(*) AS count_active FROM academic_years WHERE is_active = 1 GROUP BY school_id HAVING COUNT(*) > 1",
        'At most one active academic year per school',
    ],
    'overlapping_academic_years' => [
        "SELECT a.school_id, a.id AS first_id, b.id AS second_id FROM academic_years a JOIN academic_years b ON a.school_id = b.school_id AND a.id < b.id AND a.starts_on <= b.ends_on AND b.starts_on <= a.ends_on",
        'Academic-year date ranges do not overlap within a school',
    ],
    'multiple_active_sams_codes' => [
        "SELECT user_id, COUNT(*) AS count_active FROM sams_login_codes WHERE revoked_at IS NULL GROUP BY user_id HAVING COUNT(*) > 1",
        'At most one active SAMS Code per user',
    ],
    'orphan_users' => [
        "SELECT u.id FROM users u LEFT JOIN schools s ON s.id = u.school_id WHERE s.id IS NULL",
        'Every user belongs to an existing school',
    ],
    'orphan_classes' => [
        "SELECT c.id FROM classes c LEFT JOIN academic_years y ON y.id = c.academic_year_id WHERE y.id IS NULL",
        'Every class belongs to an existing academic year',
    ],
    'orphan_teacher_classes' => [
        "SELECT tc.teacher_id, tc.class_id FROM teacher_classes tc LEFT JOIN users u ON u.id = tc.teacher_id LEFT JOIN classes c ON c.id = tc.class_id WHERE u.id IS NULL OR c.id IS NULL",
        'Every teacher-class assignment references existing records',
    ],
    'orphan_teacher_teachings' => [
        "SELECT tt.id FROM teacher_teachings tt LEFT JOIN users u ON u.id = tt.teacher_id LEFT JOIN subjects s ON s.id = tt.subject_id LEFT JOIN classes c ON c.id = tt.class_id WHERE u.id IS NULL OR s.id IS NULL OR c.id IS NULL",
        'Every teaching assignment references existing records',
    ],
    'orphan_enrollments' => [
        "SELECT e.id FROM student_enrollments e LEFT JOIN students s ON s.id = e.student_id LEFT JOIN classes c ON c.id = e.class_id WHERE s.id IS NULL OR c.id IS NULL",
        'Every enrollment references an existing student and class',
    ],
    'orphan_attendance_enrollments' => [
        "SELECT a.id FROM attendance a LEFT JOIN student_enrollments e ON e.id = a.enrollment_id AND e.student_id = a.student_id WHERE e.id IS NULL",
        'Every attendance row matches its student enrollment',
    ],
    'invalid_attendance_values' => [
        "SELECT id FROM attendance WHERE status NOT IN ('present', 'absent', 'late', 'excused') OR period NOT BETWEEN 1 AND 8",
        'Attendance values stay inside the current schema contract',
    ],
    'orphan_revisions' => [
        "SELECT r.id FROM attendance_register_revisions r LEFT JOIN classes c ON c.id = r.class_id WHERE c.id IS NULL OR r.period NOT BETWEEN 1 AND 8",
        'Attendance revisions reference existing classes and valid periods',
    ],
];

$failures = [];
echo "[INFO] Database: " . (string)$pdo->query('SELECT DATABASE()')->fetchColumn() . PHP_EOL;

foreach ($checks as $name => [$sql, $description]) {
    $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    if ($rows !== []) {
        $failures[] = $name;
        echo "[FAIL] {$description} (" . count($rows) . " violation(s))" . PHP_EOL;
        foreach (array_slice($rows, 0, 5) as $row) echo "       " . json_encode($row, JSON_UNESCAPED_UNICODE) . PHP_EOL;
    } else {
        echo "[PASS] {$description}" . PHP_EOL;
    }
}

$summary = [
    'schools' => (int)$pdo->query('SELECT COUNT(*) FROM schools')->fetchColumn(),
    'users' => (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn(),
    'teachers' => (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = 1")->fetchColumn(),
    'classes' => (int)$pdo->query('SELECT COUNT(*) FROM classes')->fetchColumn(),
    'students' => (int)$pdo->query('SELECT COUNT(*) FROM students')->fetchColumn(),
    'attendance_rows' => (int)$pdo->query('SELECT COUNT(*) FROM attendance')->fetchColumn(),
];
echo "[INFO] Summary: " . json_encode($summary, JSON_UNESCAPED_UNICODE) . PHP_EOL;

if ($failures !== []) {
    fwrite(STDERR, "[FAIL] Database consistency checks failed: " . implode(', ', $failures) . PHP_EOL);
    exit(1);
}
echo "[PASS] Final database consistency audit completed." . PHP_EOL;