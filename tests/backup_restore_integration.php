<?php

declare(strict_types=1);

function br_expect(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function br_identifier(string $value): string
{
    br_expect((bool)preg_match('/^[A-Za-z0-9_]+$/', $value), 'Unsafe database identifier.');
    return $value;
}

function br_env(string $name, string $default = ''): string
{
    return getenv($name) !== false ? (string)getenv($name) : $default;
}

function br_pdo(string $database = ''): PDO
{
    $host = br_env('SAMS_TEST_DB_HOST', 'db');
    $port = (int)br_env('SAMS_TEST_DB_PORT', '3306');
    $user = br_env('SAMS_TEST_DB_USER', 'root');
    $pass = br_env('SAMS_TEST_DB_PASS', 'root');
    $dsn = sprintf(
        'mysql:host=%s;port=%d%s;charset=utf8mb4',
        $host,
        $port,
        $database !== '' ? ';dbname=' . br_identifier($database) : ''
    );

    return new PDO(
        $dsn,
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
}

function br_exec_command(array $command, string $stdinFile, string $stdoutFile, string $stderrFile): void
{
    $env = $_ENV;
    $env['MYSQL_PWD'] = br_env('SAMS_TEST_DB_PASS', 'root');

    $descriptor = [
        0 => ['file', $stdinFile, 'r'],
        1 => ['file', $stdoutFile, 'w'],
        2 => ['file', $stderrFile, 'w'],
    ];

    $process = proc_open($command, $descriptor, $pipes, null, $env);
    br_expect(is_resource($process), 'Unable to start database command.');

    $exitCode = proc_close($process);
    br_expect(
        $exitCode === 0,
        'Database command failed: ' . trim((string)file_get_contents($stderrFile))
    );
}

$host = br_env('SAMS_TEST_DB_HOST', 'db');
$port = (int)br_env('SAMS_TEST_DB_PORT', '3306');
$user = br_env('SAMS_TEST_DB_USER', 'root');
$source = 'sams_backup_source_' . getmypid();
$target = 'sams_backup_target_' . getmypid();
$dump = tempnam(sys_get_temp_dir(), 'sams-backup-');
$emptyInput = tempnam(sys_get_temp_dir(), 'sams-backup-input-');
$dumpOutput = tempnam(sys_get_temp_dir(), 'sams-backup-out-');
$dumpError = tempnam(sys_get_temp_dir(), 'sams-backup-err-');

br_expect($dump !== false, 'Unable to create backup file.');
br_expect($emptyInput !== false && $dumpOutput !== false && $dumpError !== false, 'Unable to create command temp files.');

try {
    $server = br_pdo();

    foreach ([$source, $target] as $dbName) {
        $server->exec('DROP DATABASE IF EXISTS ' . br_identifier($dbName));
        $server->exec('CREATE DATABASE ' . br_identifier($dbName) . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    }

    $schema = file_get_contents(__DIR__ . '/../database/schema.sql');
    br_expect($schema !== false, 'Unable to read schema.sql.');

    $schema = preg_replace(
        [
            '/CREATE DATABASE IF NOT EXISTS sams/i',
            '/\bUSE sams\b/i',
        ],
        [
            'CREATE DATABASE IF NOT EXISTS ' . $source,
            'USE ' . $source,
        ],
        $schema
    );

    br_expect($schema !== null, 'Unable to prepare isolated schema.');

    foreach (preg_split('/;\s*(?:\R|$)/', $schema, -1, PREG_SPLIT_NO_EMPTY) as $statement) {
        $statement = trim((string)$statement);
        if ($statement !== '') {
            $server->exec($statement);
        }
    }

    $db = br_pdo($source);
    $db->beginTransaction();

    $db->exec(
        "INSERT INTO academic_years (name, starts_on, ends_on, is_active)
         VALUES ('2026/2027', '2026-09-01', '2027-07-31', 1)"
    );
    $db->exec(
        "INSERT INTO users (username, employee_id, full_name, password_hash, role)
         VALUES ('backup-admin', 'BA001', 'Backup Admin', 'synthetic-hash', 'admin'),
                ('backup-teacher', 'BT001', 'Backup Teacher', 'synthetic-hash', 'teacher')"
    );
    $db->exec(
        "INSERT INTO classes (academic_year_id, name, level, branch, is_active)
         VALUES (1, 'BACKUP-A', '2BAC', 'SP', 1)"
    );
    $db->exec("INSERT INTO teacher_classes (teacher_id, class_id) VALUES (2, 1)");
    $db->exec(
        "INSERT INTO students
         (class_id, student_number, massar_code, birth_date, first_name, last_name, status)
         VALUES (1, 'B001', 'BM001', '2010-01-01', 'Backup', 'Student', 'active')"
    );
    $db->exec(
        "INSERT INTO student_enrollments (student_id, class_id, starts_on)
         VALUES (1, 1, '2026-09-01')"
    );
    $db->exec(
        "INSERT INTO attendance
         (student_id, enrollment_id, attendance_date, period, status, recorded_by)
         VALUES (1, 1, '2026-09-23', 1, 'absent', 2)"
    );
    $db->exec(
        "INSERT INTO attendance_signoffs
         (class_id, teacher_id, attendance_date, period, signature_data, status)
         VALUES (1, 2, '2026-09-23', 1, 'synthetic-period-signature', 'signed')"
    );
    $db->exec(
        "INSERT INTO attendance_week_signatures
         (class_id, teacher_id, week_start, signature_data, status)
         VALUES (1, 2, '2026-09-21', 'synthetic-week-signature', 'signed')"
    );
    $db->exec(
        "INSERT INTO attendance_week_submissions (class_id, week_start, received_by)
         VALUES (1, '2026-09-21', 1)"
    );
    $db->exec(
        "INSERT INTO signatures (teacher_id, class_id, signature_data)
         VALUES (2, 1, 'synthetic-class-signature')"
    );
    $db->exec(
        "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
         VALUES (1, 'backup.restore.test', 'student', 1, JSON_OBJECT('source', 'synthetic'))"
    );

    $db->commit();
    unset($db);

    $dumpPath = $dump . '.sql';
    $dumpCommand = [
        'mariadb-dump',
        '--protocol=tcp',
        '-h', $host,
        '-P', (string)$port,
        '-u', $user,
        '--single-transaction',
        '--routines',
        '--triggers',
        $source,
    ];

    $dumpProcess = proc_open(
        $dumpCommand,
        [
            0 => ['file', $emptyInput, 'r'],
            1 => ['file', $dumpPath, 'w'],
            2 => ['file', $dumpError, 'w'],
        ],
        $dumpPipes,
        null,
        array_replace($_ENV, ['MYSQL_PWD' => br_env('SAMS_TEST_DB_PASS', 'root')])
    );
    br_expect(is_resource($dumpProcess), 'Unable to start mariadb-dump.');
    $dumpExit = proc_close($dumpProcess);
    br_expect(
        $dumpExit === 0,
        'mariadb-dump failed: ' . trim((string)file_get_contents($dumpError))
    );

    br_expect(is_file($dumpPath) && filesize($dumpPath) > 0, 'Backup dump is empty.');

    $restoreInput = $dumpPath;
    $restoreOutput = $dumpOutput;
    $restoreError = $dumpError;
    $restoreCommand = [
        'mariadb',
        '--protocol=tcp',
        '-h', $host,
        '-P', (string)$port,
        '-u', $user,
        $target,
    ];

    br_exec_command($restoreCommand, $restoreInput, $restoreOutput, $restoreError);

    $restored = br_pdo($target);

    $checks = [
        'academic_years' => 1,
        'users' => 2,
        'classes' => 1,
        'students' => 1,
        'student_enrollments' => 1,
        'attendance' => 1,
        'attendance_signoffs' => 1,
        'attendance_week_signatures' => 1,
        'attendance_week_submissions' => 1,
        'signatures' => 1,
        'audit_logs' => 1,
    ];

    foreach ($checks as $table => $expected) {
        $actual = (int)$restored->query(
            'SELECT COUNT(*) FROM ' . br_identifier($table)
        )->fetchColumn();
        br_expect($actual === $expected, "Restore mismatch for {$table}: {$actual} != {$expected}");
    }

    $row = $restored->query(
        "SELECT
            e.class_id AS enrollment_class_id,
            e.starts_on,
            e.ends_on,
            a.attendance_date,
            a.enrollment_id,
            s.status AS period_status,
            ws.status AS week_status
         FROM attendance a
         INNER JOIN student_enrollments e ON e.id = a.enrollment_id
         INNER JOIN attendance_signoffs s
           ON s.class_id = e.class_id
          AND s.attendance_date = a.attendance_date
          AND s.period = a.period
         INNER JOIN attendance_week_signatures ws
           ON ws.class_id = e.class_id
          AND ws.teacher_id = s.teacher_id
          AND ws.week_start = '2026-09-21'
         WHERE a.student_id = 1 AND a.attendance_date = '2026-09-23'
         LIMIT 1"
    )->fetch();

    br_expect(is_array($row), 'Restored critical attendance row is missing.');
    br_expect((int)$row['enrollment_class_id'] === 1, 'Restored attendance enrollment class is incorrect.');
    br_expect((string)$row['starts_on'] === '2026-09-01', 'Restored enrollment start date is incorrect.');
    br_expect($row['ends_on'] === null, 'Restored enrollment end date is incorrect.');
    br_expect((int)$row['enrollment_id'] === 1, 'Restored attendance enrollment ID is incorrect.');
    br_expect((string)$row['period_status'] === 'signed', 'Restored period signature is incorrect.');
    br_expect((string)$row['week_status'] === 'signed', 'Restored weekly signature is incorrect.');

    echo "[PASS] Backup -> destroy -> restore preserved schema, critical records, historical enrollment, attendance, and signatures.\n";
} finally {
    $server = br_pdo();
    $server->exec('DROP DATABASE IF EXISTS ' . br_identifier($source));
    $server->exec('DROP DATABASE IF EXISTS ' . br_identifier($target));

    foreach ([$dump, $dump . '.sql', $emptyInput, $dumpOutput, $dumpError] as $path) {
        if (is_string($path) && is_file($path)) {
            @unlink($path);
        }
    }
}