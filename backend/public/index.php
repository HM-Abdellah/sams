<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/bootstrap.php';

use SAMS\Controllers\AdminAcademicYearController;
use SAMS\Controllers\AdminAuditController;
use SAMS\Controllers\AdminClassController;
use SAMS\Controllers\AdminDashboardController;
use SAMS\Controllers\AdminOnboardingController;
use SAMS\Controllers\AdminTeacherClassController;
use SAMS\Controllers\OnboardingController;
use SAMS\Controllers\AdminTeacherController;
use SAMS\Controllers\AdminUserController;
use SAMS\Controllers\ArchiveController;
use SAMS\Controllers\AuthController;
use SAMS\Controllers\AttendanceController;
use SAMS\Controllers\HealthController;
use SAMS\Controllers\ReportController;
use SAMS\Controllers\SchoolImportController;
use SAMS\Controllers\SignatureController;
use SAMS\Controllers\ProfileController;
use SAMS\Controllers\SetupController;
use SAMS\Exceptions\RequestPayloadTooLargeException;
use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Routing\Router;

try {
    $request = Request::fromGlobals();

    $configuredBasePath = trim((string)($GLOBALS['appConfig']['base_path'] ?? ''), '/');
    $siteBasePath = $configuredBasePath === ''
        ? ''
        : '/' . trim(dirname('/' . $configuredBasePath), '/');

    if ($siteBasePath === '/') {
        $siteBasePath = '';
    }

    $path = $request->path();
    $prefixes = ['/api/v1'];
    $mountedPrefix = $siteBasePath . '/api/v1';
    if ($mountedPrefix !== '/api/v1') {
        array_unshift($prefixes, $mountedPrefix);
    }

    $prefix = null;
    foreach ($prefixes as $candidate) {
        if ($path === $candidate || str_starts_with($path, $candidate . '/')) {
            $prefix = $candidate;
            break;
        }
    }

    if ($prefix === null) {
        Response::json([
            'success' => false,
            'error' => 'API route not found.',
        ], 404)->send();
    }

    $afterPrefix = substr($path, strlen($prefix));

    $apiPath = $afterPrefix === '' ? '/' : $afterPrefix;
    $apiRequest = $request->withPath($apiPath);

    $router = new Router();

    $setup = new SetupController();
    $router->get('/setup/status', $setup);
    $router->post('/setup', $setup);

    $auth = new AuthController();
    $router->get('/auth/{action}', $auth);
    $router->post('/auth/{action}', $auth);

    $profile = new ProfileController();
    $router->get('/profile', $profile);
    $router->post('/profile', $profile);
    $router->get('/profile/avatar', $profile);

    $router->get('/health', new HealthController());
    $attendance = new AttendanceController();
    $router->get('/classes/{id}/attendance', $attendance);
    $router->post('/classes/{id}/attendance/bulk', $attendance);

    $archive = new ArchiveController();
    $router->get('/admin/archive', $archive);

    $report = new ReportController();
    $router->get('/classes/{id}/report', $report);

    $signature = new SignatureController();
    $router->get('/classes/{id}/signature', $signature);
    $router->post('/classes/{id}/signature', $signature);
    $router->delete('/classes/{id}/signature', $signature);

    $adminDashboard = new AdminDashboardController();
    $router->get('/admin/dashboard', $adminDashboard);

    $adminAudit = new AdminAuditController();
    $router->get('/admin/audit', $adminAudit);

    $adminAcademicYears = new AdminAcademicYearController();
    $router->get('/admin/academic-years', $adminAcademicYears);
    $router->post('/admin/academic-years', $adminAcademicYears);

    $adminClasses = new AdminClassController();
    $router->get('/admin/classes', $adminClasses);
    $router->post('/admin/classes', $adminClasses);

    $adminUsers = new AdminUserController();
    $router->get('/admin/users', $adminUsers);
    $router->post('/admin/users', $adminUsers);

    $onboarding = new OnboardingController();
    $router->post('/onboarding/{action}', $onboarding);
    $router->get('/onboarding/{action}', $onboarding);

    $adminOnboarding = new AdminOnboardingController();
    $router->get('/admin/onboarding/{action}', $adminOnboarding);
    $router->post('/admin/onboarding/{action}', $adminOnboarding);
    $router->post('/admin/onboarding/{id}/{action}', $adminOnboarding);

    $adminTeachers = new AdminTeacherController();
    $router->get('/admin/teachers', $adminTeachers);
    $router->post('/admin/teachers', $adminTeachers);

    $adminTeacherClasses = new AdminTeacherClassController();
    $router->get('/admin/teacher-classes', $adminTeacherClasses);
    $router->post('/admin/teacher-classes', $adminTeacherClasses);
    $router->delete('/admin/teacher-classes', $adminTeacherClasses);

    $schoolImport = new SchoolImportController();
    $router->post('/imports/school', $schoolImport);
    $router->get('/imports/school/{id}', $schoolImport);
    $router->post('/imports/school/{id}/{action}', $schoolImport);

    $router->get('/', static function (): Response {
        return Response::json([
            'success' => true,
            'data' => [
                'service' => 'sams-api',
                'api_version' => 'v1',
            ],
        ]);
    });

    $router->dispatch($apiRequest)->send();
} catch (RequestPayloadTooLargeException $e) {
    Response::json([
        'success' => false,
        'error' => $e->getMessage(),
    ], 413)->send();
} catch (InvalidArgumentException $e) {
    Response::json([
        'success' => false,
        'error' => $e->getMessage(),
    ], 422)->send();
} catch (Throwable $e) {
    error_log('[SAMS API] ' . $e->getMessage());

    Response::json([
        'success' => false,
        'error' => 'Server error.',
    ], 500)->send();
}

