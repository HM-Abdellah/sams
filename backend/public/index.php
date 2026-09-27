<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/bootstrap.php';

use SAMS\Controllers\AdminAcademicYearController;
use SAMS\Controllers\AdminAuditController;
use SAMS\Controllers\AdminClassController;
use SAMS\Controllers\AdminDashboardController;
use SAMS\Controllers\AdminTeacherClassController;
use SAMS\Controllers\AdminTeacherController;
use SAMS\Controllers\AdminUserController;
use SAMS\Controllers\AttendanceController;
use SAMS\Controllers\HealthController;
use SAMS\Controllers\SchoolImportController;
use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Routing\Router;

try {
    $request = Request::fromGlobals();
    $prefix = '/api/v1';
    $path = $request->path();

    if ($path !== $prefix && !str_starts_with($path, $prefix . '/')) {
        Response::json([
            'success' => false,
            'error' => 'API route not found.',
        ], 404)->send();
    }

    $afterPrefix = substr($path, strlen($prefix));

    $apiPath = $afterPrefix === '' ? '/' : $afterPrefix;
    $apiRequest = $request->withPath($apiPath);

    $router = new Router();

    $router->get('/health', new HealthController());
    $attendance = new AttendanceController();
    $router->get('/classes/{id}/attendance', $attendance);
    $router->post('/classes/{id}/attendance/bulk', $attendance);

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