<?php

declare(strict_types=1);

require_once __DIR__ . '/../backend/vendor/autoload.php';

use SAMS\Helpers\Database;
use SAMS\Helpers\Security;
use SAMS\Repositories\UserRepository;
use SAMS\Services\LoginCodeService;

$pdo = Database::connection();
$pdo->exec("INSERT INTO schools (code, name, status) VALUES ('AUTH-HTTP', 'Auth HTTP Test', 'active') ON DUPLICATE KEY UPDATE status = 'active'");
$schoolId = (int)$pdo->query("SELECT id FROM schools WHERE code = 'AUTH-HTTP' LIMIT 1")->fetchColumn();
$users = new UserRepository();
$admin = $users->findByUsername('http-admin');
$teacher = $users->findByUsername('http-teacher');
if ($admin === null) {
    $adminId = $users->create('http-admin', 'HTTP Admin', Security::hashPassword('HttpAdminPassword123!'), 'admin', null, null, $schoolId);
} else {
    $adminId = (int)$admin['id'];
}
if ($teacher === null) {
    $teacherId = $users->create('http-teacher', 'HTTP Teacher', Security::hashPassword('HttpTeacherPassword123!'), 'teacher', 'T-HTTP', null, $schoolId);
} else {
    $teacherId = (int)$teacher['id'];
}
$teacherIssued = (new LoginCodeService())->issueForUser($adminId, $teacherId, $schoolId);
$fixture = [
    'admin_username' => 'http-admin',
    'admin_password' => 'HttpAdminPassword123!',
    'teacher_code' => $teacherIssued['sams_code'],
    'teacher_id' => $teacherId,
];
file_put_contents('/tmp/sams_auth_http_seed.json', json_encode($fixture, JSON_THROW_ON_ERROR));
echo json_encode($fixture, JSON_THROW_ON_ERROR), PHP_EOL;
