<?php

declare(strict_types=1);

require_once __DIR__ . '/../backend/vendor/autoload.php';

use SAMS\Helpers\Database;
use SAMS\Helpers\Security;
use SAMS\Repositories\UserRepository;
use SAMS\Services\LoginCodeService;
use SAMS\Services\OnboardingService;

$pdo = Database::connection();
$pdo->exec('SET FOREIGN_KEY_CHECKS=0');
foreach (['teacher_onboarding_requests','school_onboarding_codes','sams_login_codes','audit_logs','users','schools'] as $table) {
    $pdo->exec('TRUNCATE TABLE `' . $table . '`');
}
$pdo->exec('SET FOREIGN_KEY_CHECKS=1');
$pdo->exec("INSERT INTO schools (code, name, status) VALUES ('ONB-HTTP', 'Onboarding HTTP Test', 'active')");
$schoolId = (int)$pdo->lastInsertId();

$users = new UserRepository();
$adminId = $users->create('onb-http-admin', 'Onboarding HTTP Admin', Security::hashPassword('OnbHttpAdmin123!'), 'admin', null, null, $schoolId);

$adminCode = (new LoginCodeService())->issueForUser($adminId, $adminId, $schoolId)['sams_code'];
$onboardingCode = (new OnboardingService())->issueSchoolCode($adminId, $schoolId)['onboarding_code'];

$fixture = [
    'admin_code' => $adminCode,
    'admin_id' => $adminId,
    'school_id' => $schoolId,
    'admin_password' => 'OnbHttpAdmin123!',
];

echo json_encode($fixture, JSON_THROW_ON_ERROR), PHP_EOL;
