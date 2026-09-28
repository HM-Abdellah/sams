<?php

declare(strict_types=1);

require_once __DIR__ . '/../backend/vendor/autoload.php';

use SAMS\Exceptions\AttendanceWorkflowException;
use SAMS\Exceptions\StudentWorkflowException;
use SAMS\Helpers\Database;
use SAMS\Repositories\AttendanceSignoffRepository;
use SAMS\Services\StudentTransferService;
use SAMS\Services\TeacherAttendanceService;

function c_expect(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function c_db(): PDO
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

    c_expect($host !== '' && $db !== '' && $user !== '', 'Missing test database configuration.');

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

function c_exec_schema(PDO $pdo): void
{
    $schema = file_get_contents(__DIR__ . '/../database/schema.sql');
    c_expect($schema !== false, 'Unable to read schema.');
    $schema = preg_replace('/^\s*--.*$/m', '', $schema) ?? $schema;

    foreach (preg_split('/;\s*(?:\R|$)/', $schema, -1, PREG_SPLIT_NO_EMPTY) as $statement) {
        if (trim($statement) !== '') $pdo->exec($statement);
    }
}

function c_seed(PDO $pdo): void
{
    $pdo->exec("INSERT INTO academic_years (name, starts_on, ends_on, is_active)
        VALUES ('2026-2027', '2026-09-01', '2027-07-31', 1)");
    $pdo->exec("INSERT INTO users (username, full_name, password_hash, role)
        VALUES ('concurrency-admin', 'Concurrency Admin', 'x', 'admin'),
               ('concurrency-teacher', 'Concurrency Teacher', 'x', 'teacher')");
    $pdo->exec("INSERT INTO classes (academic_year_id, name, level, branch)
        VALUES (1, 'CONC-A', '2BAC', 'SP'),
               (1, 'CONC-B', '2BAC', 'SP')");
    $pdo->exec("INSERT INTO teacher_classes (teacher_id, class_id) VALUES (2, 1)");
    $pdo->exec("INSERT INTO signatures (teacher_id, class_id, signature_data)
        VALUES (2, 1, 'synthetic-signature')");
    $pdo->exec("INSERT INTO students
        (class_id, student_number, massar_code, birth_date, first_name, last_name)
        VALUES (1, 'C001', 'CM001', '2010-01-01', 'Concurrency', 'Student')");
    $pdo->exec("INSERT INTO student_enrollments (student_id, class_id, starts_on)
        VALUES (1, 1, '2026-09-01')");
}

function c_reset_transfer(PDO $pdo): void
{
    $pdo->exec('DELETE FROM attendance');
    $pdo->exec('DELETE FROM student_enrollments');
    $pdo->exec("UPDATE students SET class_id = 1, status = 'active' WHERE id = 1");
    $pdo->exec("INSERT INTO student_enrollments (student_id, class_id, starts_on)
        VALUES (1, 1, '2026-09-01')");
}

function c_reset_certification(PDO $pdo): void
{
    $pdo->exec('DELETE FROM attendance_week_submissions');
    $pdo->exec('DELETE FROM attendance_week_signatures');
    $pdo->exec('DELETE FROM attendance_signoffs');
    $pdo->exec('DELETE FROM attendance');
    c_reset_transfer($pdo);

    $enrollmentId = (int)$pdo->query(
        "SELECT id FROM student_enrollments
         WHERE student_id = 1 AND class_id = 1 AND ends_on IS NULL
         ORDER BY id DESC LIMIT 1"
    )->fetchColumn();
    c_expect($enrollmentId > 0, 'R-002 setup: missing active enrollment.');

    $pdo->exec("INSERT INTO attendance
        (student_id, enrollment_id, attendance_date, period, status, recorded_by)
        VALUES (1, {$enrollmentId}, '2026-09-23', 1, 'absent', 2)");
    $pdo->exec("INSERT INTO attendance_signoffs
        (class_id, teacher_id, attendance_date, period, signature_data, status)
        VALUES (1, 2, '2026-09-23', 1, 'synthetic-signature', 'signed')");
    $pdo->exec("INSERT INTO attendance_week_signatures
        (class_id, teacher_id, week_start, signature_data, status)
        VALUES (1, 2, '2026-09-21', 'synthetic-week', 'signed')");
}

function c_reset_receive(PDO $pdo): void
{
    c_reset_certification($pdo);
    $pdo->exec("INSERT INTO attendance_week_submissions
        (class_id, week_start, received_by)
        VALUES (1, '2026-09-21', 1)");
    $pdo->exec("UPDATE attendance_week_signatures
        SET status = 'signed', invalidated_at = NULL, invalidated_by = NULL
        WHERE class_id = 1 AND teacher_id = 2 AND week_start = '2026-09-21'");
}

function c_child(string $mode, string $gate): never
{
    file_put_contents($gate . '.' . $mode . '.ready', '1');
    $deadline = microtime(true) + 10.0;

    while (!is_file($gate . '.go')) {
        if (microtime(true) > $deadline) {
            fwrite(STDERR, "Barrier timeout\n");
            exit(2);
        }
        usleep(1000);
    }

    try {
        switch ($mode) {
            case 'r1-transfer':
                (new StudentTransferService())->transfer(
                    1, 'admin', 1, 1, 2, '2026-09-15'
                );
                break;

            case 'r1-attendance':
                (new TeacherAttendanceService())->saveBulk(
                    2,
                    'teacher',
                    1,
                    [[
                        'student_id' => 1,
                        'attendance_date' => '2026-09-15',
                        'period' => 1,
                        'action' => 'upsert',
                        'status' => 'absent',
                    ]]
                );
                break;

            case 'r2-invalidate':
                c_invalidate_signed_lesson();
                break;

            case 'r2-sign':
                c_sign_week_transaction();
                break;

            case 'r2-receive':
                c_receive_week_transaction();
                break;

            default:
                throw new RuntimeException('Unknown concurrency mode: ' . $mode);
        }

        echo "RESULT=SUCCESS mode={$mode}\n";
        exit(0);
    } catch (AttendanceWorkflowException|StudentWorkflowException $e) {
        echo "RESULT=EXPECTED_REJECT mode={$mode} message=" . $e->getMessage() . "\n";
        exit(0);
    } catch (RuntimeException $e) {
        if (str_starts_with($e->getMessage(), 'EXPECTED_REJECT:')) {
            echo "RESULT=EXPECTED_REJECT mode={$mode}\n";
            exit(0);
        }
        fwrite(STDERR, get_class($e) . ': ' . $e->getMessage() . "\n");
        exit(1);
    } catch (Throwable $e) {
        fwrite(STDERR, get_class($e) . ': ' . $e->getMessage() . "\n");
        exit(1);
    }
}

function c_invalidate_signed_lesson(): void
{
    $pdo = Database::connection();
    $repo = new AttendanceSignoffRepository();

    $pdo->beginTransaction();

    $lock = $pdo->prepare('SELECT id FROM classes WHERE id = ? FOR UPDATE');
    $lock->execute([1]);
    if ($lock->fetchColumn() === false) {
        throw new RuntimeException('Class lock failed.');
    }

    $repo->invalidatePeriod(1, '2026-09-23', 1, 2);
    $repo->invalidateWeekSignature(1, '2026-09-21', 2);
    $repo->clearSubmission(1, '2026-09-21');

    $pdo->commit();
}

function c_sign_week_transaction(): void
{
    $pdo = Database::connection();
    $repo = new AttendanceSignoffRepository();

    $pdo->beginTransaction();

    $lock = $pdo->prepare('SELECT id FROM classes WHERE id = ? FOR UPDATE');
    $lock->execute([1]);
    if ($lock->fetchColumn() === false) throw new RuntimeException('Class lock failed.');

    $counts = $repo->countTeacherPeriodSignoffs(1, 2, '2026-09-21', '2026-09-26');
    if ((int)$counts['signed_lessons'] < 1) {
        throw new RuntimeException('EXPECTED_REJECT: no signed lessons');
    }
    if ((int)$counts['needs_resign'] > 0) {
        throw new RuntimeException('EXPECTED_REJECT: lesson needs re-sign');
    }

    $repo->upsertWeekSignature(1, 2, '2026-09-21', 'synthetic-week');
    $pdo->commit();
}

function c_receive_week_transaction(): void
{
    $pdo = Database::connection();
    $repo = new AttendanceSignoffRepository();

    $pdo->beginTransaction();

    $lock = $pdo->prepare('SELECT id FROM classes WHERE id = ? FOR UPDATE');
    $lock->execute([1]);
    if ($lock->fetchColumn() === false) throw new RuntimeException('Class lock failed.');

    $teachers = $repo->teachersForClass(1);
    $weeklyRows = $repo->weekSignatures(1, '2026-09-21');
    $weeklyByTeacher = [];
    foreach ($weeklyRows as $row) {
        $weeklyByTeacher[(int)$row['teacher_id']] = $row;
    }

    if ($teachers === [] || count($weeklyByTeacher) < count($teachers)) {
        throw new RuntimeException('EXPECTED_REJECT: missing weekly signature');
    }
    foreach ($teachers as $teacher) {
        $row = $weeklyByTeacher[(int)$teacher['id']] ?? null;
        if ($row === null || (string)$row['status'] !== 'signed') {
            throw new RuntimeException('EXPECTED_REJECT: weekly signature not valid');
        }
    }

    $repo->receiveWeek(1, '2026-09-21', 1);
    $pdo->commit();
}

function c_pair(string $a, string $b): array
{
    $gate = tempnam(sys_get_temp_dir(), 'sams-conc-');
    c_expect($gate !== false, 'Unable to create concurrency barrier.');

    @unlink($gate);
    $processes = [];
    foreach ([$a, $b] as $mode) {
        $descriptor = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $process = proc_open([PHP_BINARY, __FILE__, 'child', $mode, $gate], $descriptor, $pipes);
        c_expect(is_resource($process), "Unable to start child {$mode}.");
        $processes[] = [$mode, $process, $pipes];
    }

    $deadline = microtime(true) + 10.0;
    foreach ([$a, $b] as $mode) {
        while (!is_file($gate . '.' . $mode . '.ready')) {
            c_expect(microtime(true) <= $deadline, "Child {$mode} never reached barrier.");
            usleep(1000);
        }
    }
    file_put_contents($gate . '.go', '1');

    $results = [];
    foreach ($processes as [$mode, $process, $pipes]) {
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($process);
        $results[$mode] = [
            'exit' => $exitCode,
            'stdout' => $stdout,
            'stderr' => $stderr,
        ];
        c_expect($exitCode === 0, "Concurrency child {$mode} failed: {$stderr}{$stdout}");
    }

    foreach ([$a, $b] as $mode) {
        @unlink($gate . '.' . $mode . '.ready');
    }
    @unlink($gate . '.go');

    return $results;
}
function c_verify_transfer(PDO $pdo, int $round): void
{
    $student = $pdo->query(
        'SELECT class_id, status FROM students WHERE id = 1'
    )->fetch();

    $enrollments = $pdo->query(
        'SELECT id, class_id, starts_on, ends_on
         FROM student_enrollments
         WHERE student_id = 1
         ORDER BY starts_on, id'
    )->fetchAll();

    $attendance = $pdo->query(
        'SELECT enrollment_id, attendance_date, period
         FROM attendance
         WHERE student_id = 1
         ORDER BY id'
    )->fetchAll();

    c_expect(is_array($student), "R-001 round {$round}: missing student.");

    $transferWon = (int)$student['class_id'] === 2;
    $attendanceWon = (int)$student['class_id'] === 1;

    c_expect($transferWon xor $attendanceWon, "R-001 round {$round}: neither allowed final owner state.");

    if ($transferWon) {
        c_expect(count($attendance) === 0, "R-001 round {$round}: attendance survived a successful transfer.");
        c_expect(count($enrollments) === 2, "R-001 round {$round}: transfer did not produce two enrollment intervals.");
        c_expect($enrollments[0]['ends_on'] === '2026-09-14', "R-001 round {$round}: old enrollment interval is wrong.");
        c_expect($enrollments[1]['starts_on'] === '2026-09-15', "R-001 round {$round}: new enrollment interval is wrong.");
    } else {
        c_expect(count($attendance) === 1, "R-001 round {$round}: attendance operation did not persist.");
        c_expect((int)$attendance[0]['enrollment_id'] === (int)$enrollments[0]['id'], "R-001 round {$round}: attendance is not attached to the only valid enrollment.");
        c_expect($enrollments[0]['ends_on'] === null, "R-001 round {$round}: transfer committed after attendance won.");
    }
}

function c_verify_certification(PDO $pdo, int $round): void
{
    $status = $pdo->query(
        "SELECT status FROM attendance_week_signatures
         WHERE class_id = 1 AND teacher_id = 2 AND week_start = '2026-09-21'"
    )->fetchColumn();

    $needsResign = (int)$pdo->query(
        "SELECT COUNT(*) FROM attendance_signoffs
         WHERE class_id = 1 AND attendance_date BETWEEN '2026-09-21' AND '2026-09-26'
           AND status = 'needs_resign'"
    )->fetchColumn();

    c_expect(
        !($status === 'signed' && $needsResign > 0),
        "R-002 sign_week round {$round}: signed weekly certification coexists with needs_resign."
    );
}

function c_verify_receive(PDO $pdo, int $round): void
{
    $status = $pdo->query(
        "SELECT status FROM attendance_week_signatures
         WHERE class_id = 1 AND teacher_id = 2 AND week_start = '2026-09-21'"
    )->fetchColumn();

    $needsResign = (int)$pdo->query(
        "SELECT COUNT(*) FROM attendance_signoffs
         WHERE class_id = 1 AND attendance_date BETWEEN '2026-09-21' AND '2026-09-26'
           AND status = 'needs_resign'"
    )->fetchColumn();

    $submission = (int)$pdo->query(
        "SELECT COUNT(*) FROM attendance_week_submissions
         WHERE class_id = 1 AND week_start = '2026-09-21'"
    )->fetchColumn();

    c_expect(
        !($status === 'signed' && $needsResign > 0),
        "R-002 receive_week round {$round}: signed weekly certification coexists with needs_resign."
    );

    if ($submission > 0) {
        c_expect($status === 'signed' && $needsResign === 0,
            "R-002 receive_week round {$round}: received submission survived an invalidated weekly state.");
    }
}

$mode = $argv[1] ?? '';
if ($mode === 'child') {
    c_child((string)($argv[2] ?? ''), (string)($argv[3] ?? ''));
}

$pdo = c_db();
c_exec_schema($pdo);
c_seed($pdo);

$rounds = 8;

for ($round = 1; $round <= $rounds; ++$round) {
    c_reset_transfer($pdo);
    $results = c_pair('r1-transfer', 'r1-attendance');
    c_verify_transfer($pdo, $round);
    printf("[PASS] R-001 concurrency round %d\n", $round);

    c_reset_certification($pdo);
    c_pair('r2-sign', 'r2-invalidate');
    c_verify_certification($pdo, $round);
    printf("[PASS] R-002 sign_week concurrency round %d\n", $round);

    c_reset_receive($pdo);
    c_pair('r2-receive', 'r2-invalidate');
    c_verify_receive($pdo, $round);
    printf("[PASS] R-002 receive_week concurrency round %d\n", $round);
}

echo "Concurrency regression suite: PASS\n";