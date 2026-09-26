<?php

declare(strict_types=1);

require_once __DIR__ . '/../backend/src/bootstrap.php';

ob_start();

function expect_true(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function expect_throws(callable $callback, string $message): void
{
    try {
        $callback();
    } catch (Throwable) {
        return;
    }

    throw new RuntimeException($message);
}

$passed = 0;
$failed = 0;

$tests = [
    'attendance accepts valid statuses' => static function (): void {
        $service = new SAMS\Services\AttendanceService();
        expect_true(
            $service->validate(1, '2026-09-25', 1, 'present')['status'] === 'present',
            'present status should be accepted'
        );
        expect_true(
            $service->validStatus('excused'),
            'excused should be a valid status'
        );
    },

    'attendance rejects invalid keys' => static function (): void {
        $service = new SAMS\Services\AttendanceService();
        expect_throws(
            static fn() => $service->validateKey(1, '2026-02-30', 1),
            'invalid date should be rejected'
        );
        expect_throws(
            static fn() => $service->validateKey(1, '2026-09-25', 9),
            'period 9 should be rejected'
        );
    },

    'student validation normalizes identity fields' => static function (): void {
        $service = new SAMS\Services\StudentService();
        expect_true(
            $service->validateName('  Jean   Dupont  ', 'name') === 'Jean Dupont',
            'name whitespace should be normalized'
        );
        expect_true(
            $service->normalizeMassarCode(' AB123 ') === 'AB123',
            'Massar code should be trimmed'
        );
        expect_true(
            $service->validateBirthDate('2010-05-12') === '2010-05-12',
            'valid birth date should be accepted'
        );
    },

    'student validation rejects future birth dates' => static function (): void {
        $service = new SAMS\Services\StudentService();
        expect_throws(
            static fn() => $service->validateBirthDate('2099-01-01'),
            'future birth date should be rejected'
        );
    },

    'class validation collapses whitespace' => static function (): void {
        $service = new SAMS\Services\ClassService();
        expect_true(
            $service->normalizeName('  2BAC   SP  A ') === '2BAC SP A',
            'class name whitespace should be normalized'
        );
    },

    'user validation enforces supported roles and password length' => static function (): void {
        $service = new SAMS\Services\UserService();
        expect_true(
            $service->validateRole('teacher') === 'teacher',
            'teacher role should be accepted'
        );
        expect_throws(
            static fn() => $service->validateRole('student'),
            'unsupported role should be rejected'
        );
        expect_throws(
            static fn() => $service->validatePassword('short'),
            'short password should be rejected'
        );
    },

    'weekly range always starts Monday and spans six days' => static function (): void {
        $service = new SAMS\Services\ReportService();

        expect_true(
            $service->weekRange('2026-09-23') === ['2026-09-21', '2026-09-26'],
            'Wednesday input should normalize to Monday-Saturday'
        );

        expect_true(
            $service->weekRange('2026-09-21') === ['2026-09-21', '2026-09-26'],
            'Monday input should remain unchanged'
        );
    },

    'academic year requires ordered dates' => static function (): void {
        $service = new SAMS\Services\AcademicYearService();
        expect_true(
            $service->validateRange('2026-09-01', '2027-07-31') === ['2026-09-01', '2027-07-31'],
            'valid academic year range should be accepted'
        );
        expect_throws(
            static fn() => $service->validateRange('2027-07-31', '2026-09-01'),
            'reversed academic year range should be rejected'
        );
    },

    'student import parses and validates a clean CSV' => static function (): void {
        $service = new SAMS\Services\StudentImportService();
        $parsed = $service->parseCsv(
            "first_name,last_name,massar_code,birth_date,student_number\n"
            . "Jean,Dupont,MC001,2010-05-12,ST001\n"
            . "Marie,Martin,MC002,2010-06-20,"
        );

        $rows = $service->validateRows($parsed);
        $summary = $service->summarize($rows);

        expect_true(count($rows) === 2, 'CSV row count should be 2');
        expect_true($summary === [
            'total_rows' => 2,
            'valid_rows' => 2,
            'warning_rows' => 0,
            'error_rows' => 0,
        ], 'clean CSV should validate all rows');
        expect_true($rows[0]['massar_code'] === 'MC001', 'Massar code should be normalized');
    },

    'student import blocks duplicates and missing required values' => static function (): void {
        $service = new SAMS\Services\StudentImportService();
        $parsed = $service->parseCsv(
            "first_name,last_name,massar_code,birth_date,student_number\n"
            . "Jean,Dupont,MC001,2010-05-12,ST001\n"
            . "Marie,Martin,MC001,,ST001"
        );

        $rows = $service->validateRows($parsed, ['MC999' => 9], ['ST999' => true]);
        $summary = $service->summarize($rows);

        expect_true($summary['error_rows'] === 1, 'Invalid import row should be marked as error');
        expect_true(in_array(
            'Duplicate Massar code in the import file.',
            $rows[1]['issues'],
            true
        ), 'Duplicate Massar should be reported');
        expect_true(in_array(
            'Birth date is required.',
            $rows[1]['issues'],
            true
        ), 'Missing birth date should be reported');

        $parsedExisting = $service->parseCsv(
            "first_name,last_name,massar_code,birth_date,student_number\n"
            . "Existing,Student,MC999,2010-05-12,ST999"
        );
        $existing = $service->validateRows($parsedExisting, ['MC999' => 9], ['ST999' => true]);

        expect_true(in_array(
            'Massar code already exists in SAMS.',
            $existing[0]['issues'],
            true
        ), 'Existing Massar should be reported');

        expect_true(in_array(
            'Student number already exists in the target class.',
            $existing[0]['issues'],
            true
        ), 'Existing student number should be reported');
    },

    'student import rejects missing required CSV columns' => static function (): void {
        $service = new SAMS\Services\StudentImportService();
        expect_throws(
            static fn() => $service->parseCsv("first_name,last_name,birth_date\nJean,Dupont,2010-05-12"),
            'missing Massar column should be rejected'
        );
    },

    'student import rejects unsupported CSV columns' => static function (): void {
        $service = new SAMS\Services\StudentImportService();
        expect_throws(
            static fn() => $service->parseCsv(
                "first_name,last_name,massar_code,birth_date,email\n"
                . "Jean,Dupont,MC001,2010-05-12,jean@example.com"
            ),
            'unsupported CSV columns should be rejected'
        );
    },

    'auth login stores a valid session identity' => static function (): void {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }

        try {
            SAMS\Helpers\Auth::login([
                'id' => 42,
                'full_name' => 'Integration User',
                'role' => 'teacher',
                'session_version' => 7,
            ]);

            expect_true(
                ($_SESSION['_auth_user']['id'] ?? null) === 42,
                'authenticated user id was not stored in session'
            );
            expect_true(
                ($_SESSION['_auth_user']['session_version'] ?? null) === 7,
                'session version was not stored correctly'
            );
        } finally {
            $_SESSION = [];
            if (session_status() === PHP_SESSION_ACTIVE) {
                session_destroy();
            }
        }
    },
];

foreach ($tests as $name => $test) {
    try {
        $test();
        ++$passed;
        echo "[PASS] {$name}" . PHP_EOL;
    } catch (Throwable $e) {
        ++$failed;
        fwrite(STDERR, "[FAIL] {$name}: {$e->getMessage()}" . PHP_EOL);
    }
}

echo PHP_EOL . "Passed: {$passed}; Failed: {$failed}" . PHP_EOL;
ob_end_flush();
exit($failed === 0 ? 0 : 1);
