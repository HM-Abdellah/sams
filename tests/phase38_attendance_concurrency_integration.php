<?php

declare(strict_types=1);

require_once __DIR__ . '/../backend/vendor/autoload.php';

use SAMS\Exceptions\AttendanceWorkflowException;
use SAMS\Services\TeacherAttendanceService;

function p38_expect(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function p38_db(): PDO
{
    $host = getenv('SAMS_TEST_DB_HOST') ?: '';
    $port = (int)(getenv('SAMS_TEST_DB_PORT') ?: 3306);
    $db = getenv('SAMS_TEST_DB_NAME') ?: '';
    $user = getenv('SAMS_TEST_DB_USER') ?: '';
    $pass = getenv('SAMS_TEST_DB_PASS') ?: '';

    if ($host === '' || $db === '' || $user === '') {
        $configPath = __DIR__ . '/../backend/config/database.php';
        $config = is_file($configPath) ? require $configPath : null;
        if (is_array($config)) {
            $host = (string)($config['host'] ?? $host);
            $port = (int)($config['port'] ?? $port);
            $db = (string)($config['database'] ?? $db);
            $user = (string)($config['username'] ?? $user);
            $pass = (string)($config['password'] ?? $pass);
        }
    }

    p38_expect($host !== '' && $db !== '' && $user !== '', 'Missing test database configuration.');

    return new PDO(
        sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $db),
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
}
function p38_schema(PDO $pdo): void
{
    $schema = file_get_contents(__DIR__ . '/../database/schema.sql');
    p38_expect($schema !== false, 'Unable to read schema.');
    $schema = preg_replace('/^\s*--.*$/m', '', $schema) ?? $schema;

    foreach (preg_split('/;\s*(?:\R|$)/', $schema, -1, PREG_SPLIT_NO_EMPTY) as $statement) {
        if (trim($statement) !== '') {
            $pdo->exec($statement);
        }
    }
}

function p38_expect_conflict(callable $callback): void
{
    try {
        $callback();
    } catch (AttendanceWorkflowException $e) {
        p38_expect($e->httpStatus() === 409, 'Stale attendance write returned the wrong status.');
        return;
    }

    throw new RuntimeException('Stale attendance write was silently accepted.');
}

function p38_child(string $userId, string $status, string $gate): never
{
    file_put_contents($gate . '.' . $userId . '.ready', '1');
    $deadline = microtime(true) + 10.0;

    while (!is_file($gate . '.go')) {
        if (microtime(true) > $deadline) {
            fwrite(STDERR, 'Concurrency barrier timeout.');
            exit(2);
        }
        usleep(1000);
    }

    try {
        $service = new TeacherAttendanceService();
        $result = $service->saveBulk((int)$userId, 'teacher', 1, [[
            'student_id' => 1,
            'attendance_date' => '2026-09-25',
            'period' => 1,
            'action' => 'upsert',
            'status' => $status,
            'expected_revision' => 0,
        ]], 1);

        echo "RESULT=SUCCESS user={$userId} revision=" . (int)$result['revisions'][0]['revision'] . "\n";
        exit(0);
    } catch (AttendanceWorkflowException $e) {
        if ($e->httpStatus() === 409) {
            echo "RESULT=CONFLICT user={$userId}\n";
            exit(0);
        }

        fwrite(STDERR, $e->getMessage());
        exit(1);
    } catch (Throwable $e) {
        fwrite(STDERR, get_class($e) . ': ' . $e->getMessage());
        exit(1);
    }
}

function p38_concurrent_writes(): array
{
    $gate = tempnam(sys_get_temp_dir(), 'sams-p38-');
    p38_expect($gate !== false, 'Unable to create concurrency barrier.');
    @unlink($gate);

    $children = [
        ['user' => 2, 'status' => 'absent'],
        ['user' => 3, 'status' => 'late'],
    ];

    $processes = [];
    foreach ($children as $child) {
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $process = proc_open(
            [PHP_BINARY, __FILE__, 'child', (string)$child['user'], $child['status'], $gate],
            $descriptors,
            $pipes
        );
        p38_expect(is_resource($process), 'Unable to start concurrency child.');
        $processes[] = [$child, $process, $pipes];
    }

    $deadline = microtime(true) + 10.0;
    foreach ($children as $child) {
        $ready = $gate . '.' . $child['user'] . '.ready';
        while (!is_file($ready)) {
            p38_expect(microtime(true) <= $deadline, 'Concurrency child never reached barrier.');
            usleep(1000);
        }
    }

    file_put_contents($gate . '.go', '1');

    $results = [];
    foreach ($processes as [$child, $process, $pipes]) {
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($process);
        p38_expect($exitCode === 0, 'Concurrency child failed: ' . $stderr . $stdout);
        $results[$child['user']] = trim($stdout);
        @unlink($gate . '.' . $child['user'] . '.ready');
    }

    @unlink($gate . '.go');

    return $results;
}

if (($argv[1] ?? '') === 'child') {
    p38_child((string)($argv[2] ?? ''), (string)($argv[3] ?? ''), (string)($argv[4] ?? ''));
}

$pdo = p38_db();
p38_schema($pdo);

$pdo->exec("INSERT INTO schools (code, name) VALUES ('P38-SCHOOL', 'Phase 38 Concurrency School')");
$pdo->exec("INSERT INTO academic_years (school_id, name, starts_on, ends_on, is_active)
VALUES (1, '2026/2027', '2026-09-01', '2027-07-31', 1)");
$pdo->exec("INSERT INTO users (school_id, username, full_name, password_hash, role)
VALUES (1, 'p38-admin', 'P38 Admin', 'x', 'admin'),
       (1, 'p38-teacher', 'P38 Teacher', 'x', 'teacher'),
       (1, 'p38-other', 'P38 Other Teacher', 'x', 'teacher'),
       (1, 'p38-unassigned', 'P38 Unassigned Teacher', 'x', 'teacher')");
$pdo->exec("INSERT INTO classes (academic_year_id, name, level, branch)
VALUES (1, 'P38-A', '2BAC', 'SP'), (1, 'P38-B', '2BAC', 'SP')");
$pdo->exec("INSERT INTO teacher_classes (teacher_id, class_id) VALUES (2, 1), (3, 1)");
$pdo->exec("INSERT INTO students
    (class_id, student_number, massar_code, birth_date, first_name, last_name)
VALUES (1, 'P38-S001', 'P38M001', '2010-01-01', 'Phase', 'Thirty Eight')");
$pdo->exec("INSERT INTO student_enrollments (student_id, class_id, starts_on)
VALUES (1, 1, '2026-09-01')");

$service = new TeacherAttendanceService();
$week = $service->weeklyRegister(2, 'teacher', 1, '2026-09-23');
p38_expect($week['attendance_revisions'] === [], 'Fresh register should have no revision rows.');
$first = $service->saveBulk(2, 'teacher', 1, [[
    'student_id' => 1,
    'attendance_date' => '2026-09-23',
    'period' => 1,
    'action' => 'upsert',
    'status' => 'absent',
    'expected_revision' => 0,
]], 1);
p38_expect($first['changed'] === 1, 'Initial attendance write failed.');
p38_expect((int)$first['revisions'][0]['revision'] === 1, 'First lesson mutation must create revision 1.');

$afterFirst = $service->weeklyRegister(2, 'teacher', 1, '2026-09-23');
p38_expect(
    (int)$afterFirst['attendance_revisions'][0]['revision'] === 1,
    'Weekly register did not expose the authoritative revision.'
);

p38_expect_conflict(
    static fn() => $service->saveBulk(2, 'teacher', 1, [[
        'student_id' => 1,
        'attendance_date' => '2026-09-23',
        'period' => 1,
        'action' => 'upsert',
        'status' => 'late',
        'expected_revision' => 0,
    ]], 1)
);

$row = $pdo->query("SELECT status FROM attendance
    WHERE student_id = 1 AND attendance_date = '2026-09-23' AND period = 1")->fetchColumn();
p38_expect($row === 'absent', 'A stale write changed the committed attendance state.');

$idempotent = $service->saveBulk(2, 'teacher', 1, [[
    'student_id' => 1,
    'attendance_date' => '2026-09-23',
    'period' => 1,
    'action' => 'upsert',
    'status' => 'absent',
    'expected_revision' => 0,
]], 1);
p38_expect($idempotent['changed'] === 0 && $idempotent['unchanged'] === 1, 'An already-committed retry was not idempotent.');
$deleted = $service->saveBulk(2, 'teacher', 1, [[
    'student_id' => 1,
    'attendance_date' => '2026-09-23',
    'period' => 1,
    'action' => 'delete',
    'expected_revision' => 1,
]], 1);
p38_expect((int)$deleted['revisions'][0]['revision'] === 2, 'Delete must advance the lesson revision.');
p38_expect(
    (int)$pdo->query("SELECT COUNT(*) FROM attendance
        WHERE student_id = 1 AND attendance_date = '2026-09-23' AND period = 1")->fetchColumn() === 0,
    'Attendance delete did not remove the row.'
);

p38_expect_conflict(
    static fn() => $service->saveBulk(2, 'teacher', 1, [[
        'student_id' => 1,
        'attendance_date' => '2026-09-23',
        'period' => 1,
        'action' => 'upsert',
        'status' => 'present',
        'expected_revision' => 1,
    ]], 1)
);

$recreated = $service->saveBulk(2, 'teacher', 1, [[
    'student_id' => 1,
    'attendance_date' => '2026-09-23',
    'period' => 1,
    'action' => 'upsert',
    'status' => 'present',
    'expected_revision' => 2,
]], 1);
p38_expect((int)$recreated['revisions'][0]['revision'] === 3, 'Current revision was not accepted after delete.');
$periodTwo = $service->saveBulk(2, 'teacher', 1, [[
    'student_id' => 1,
    'attendance_date' => '2026-09-23',
    'period' => 2,
    'action' => 'upsert',
    'status' => 'late',
    'expected_revision' => 0,
]], 1);
p38_expect((int)$periodTwo['revisions'][0]['revision'] === 1, 'Revisions should be independent per lesson.');

$beforeAtomic = $pdo->query("SELECT status FROM attendance
    WHERE student_id = 1 AND attendance_date = '2026-09-23' AND period = 2")->fetchColumn();
p38_expect($beforeAtomic === 'late', 'Atomic conflict fixture did not persist period 2.');

p38_expect_conflict(
    static fn() => $service->saveBulk(2, 'teacher', 1, [
        [
            'student_id' => 1,
            'attendance_date' => '2026-09-23',
            'period' => 1,
            'action' => 'upsert',
            'status' => 'absent',
            'expected_revision' => 2,
        ],
        [
            'student_id' => 1,
            'attendance_date' => '2026-09-23',
            'period' => 2,
            'action' => 'upsert',
            'status' => 'present',
            'expected_revision' => 1,
        ],
    ], 1)
);
$afterAtomic = $pdo->query("SELECT status FROM attendance
    WHERE student_id = 1 AND attendance_date = '2026-09-23' AND period = 2")->fetchColumn();
p38_expect($afterAtomic === $beforeAtomic, 'A conflicting bulk batch partially committed another lesson.');

$concurrent = p38_concurrent_writes();
$concurrentValues = array_values($concurrent);
p38_expect(count(array_filter($concurrentValues, static fn(string $value): bool => str_starts_with($value, 'RESULT=SUCCESS'))) === 1, 'Exactly one concurrent teacher write must commit.');
p38_expect(count(array_filter($concurrentValues, static fn(string $value): bool => str_starts_with($value, 'RESULT=CONFLICT'))) === 1, 'The stale concurrent teacher write must be rejected.');

$finalConcurrentStatus = (string)$pdo->query("SELECT status FROM attendance
    WHERE student_id = 1 AND attendance_date = '2026-09-25' AND period = 1")->fetchColumn();
$finalConcurrentRevision = (int)$pdo->query("SELECT revision FROM attendance_register_revisions
    WHERE class_id = 1 AND attendance_date = '2026-09-25' AND period = 1")->fetchColumn();
p38_expect(in_array($finalConcurrentStatus, ['absent', 'late'], true), 'Concurrent write did not leave a valid committed status.');
p38_expect($finalConcurrentRevision === 1, 'Concurrent write must commit exactly one revision.');

try {
    $service->saveBulk(4, 'teacher', 1, [[
        'student_id' => 1,
        'attendance_date' => '2026-09-24',
        'period' => 1,
        'action' => 'upsert',
        'status' => 'absent',
        'expected_revision' => 0,
    ]], 1);
    throw new RuntimeException('Unassigned teacher was allowed to edit shared attendance.');
} catch (AttendanceWorkflowException $e) {
    p38_expect($e->httpStatus() === 403, 'Unassigned teacher returned the wrong status.');
}

echo "[PASS] Phase 38 shared attendance revision/concurrency integration\n";
echo "[PASS] stale-write protection, idempotent retry, delete/recreate protection, atomic conflict, per-lesson revisions, and authorization verified\n";
