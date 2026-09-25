<?php

declare(strict_types=1);

require_once __DIR__ . '/../app/Services/AttendanceService.php';
require_once __DIR__ . '/../app/Services/ClassService.php';
require_once __DIR__ . '/../app/Services/StudentService.php';
require_once __DIR__ . '/../app/Services/UserService.php';
require_once __DIR__ . '/../app/Services/AcademicYearService.php';
require_once __DIR__ . '/../app/Helpers/Security.php';
require_once __DIR__ . '/../app/Helpers/Csrf.php';
require_once __DIR__ . '/../app/Helpers/Auth.php';

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
exit($failed === 0 ? 0 : 1);
