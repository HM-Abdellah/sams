<?php

declare(strict_types=1);

function req(string $method, string $url, ?array $body = null, ?string $cookie = null, ?string $csrf = null): array
{
    $headers = ['Content-Type: application/json'];
    if ($cookie !== null) $headers[] = 'Cookie: ' . $cookie;
    if ($csrf !== null) $headers[] = 'X-CSRF-Token: ' . $csrf;
    $options = ['http' => [
        'method' => $method,
        'ignore_errors' => true,
        'header' => implode("\r\n", $headers),
    ]];
    if ($body !== null) $options['http']['content'] = json_encode($body, JSON_THROW_ON_ERROR);
    $response = file_get_contents($url, false, stream_context_create($options));
    if ($response === false) throw new RuntimeException('HTTP request failed.');
    $status = 0;
    $cookies = [];
    foreach ($http_response_header ?? [] as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $m)) $status = (int)$m[1];
        if (stripos($header, 'Set-Cookie:') === 0 && preg_match('/Set-Cookie:\s*([^;]+)/i', $header, $m)) $cookies[] = $m[1];
    }
    return [$status, json_decode($response, true, 512, JSON_THROW_ON_ERROR), implode('; ', $cookies)];
}
function expect_ok(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }

$fixture = json_decode((string)getenv('SAMS_ONB_HTTP_FIXTURE'), true, 512, JSON_THROW_ON_ERROR);
$base = (string)(getenv('SAMS_ONB_HTTP_BASE') ?: 'http://127.0.0.1:8085/api/v1');

[$status, $session, $cookie] = req('GET', $base . '/auth/session');
expect_ok($status === 200 && ($session['data']['authenticated'] ?? true) === false, 'Anonymous auth session failed.');
$csrf = (string)$session['data']['csrf'];

[$status, $login, $loginCookie] = req('POST', $base . '/auth/login', [
    'identifier' => $fixture['admin_username'],
    'password' => $fixture['admin_password'],
], $cookie, $csrf);
expect_ok($status === 200 && ($login['success'] ?? false) === true, 'Admin canonical login failed.');
$adminCookie = $loginCookie !== '' ? $loginCookie : $cookie;
$adminCsrf = (string)$login['data']['csrf'];

[$status, $codeResponse] = req('POST', $base . '/admin/onboarding/code', ['action' => 'code'], $adminCookie, $adminCsrf);
expect_ok(
    $status === 200 && ($codeResponse['success'] ?? false) === true,
    'Admin onboarding-code rotation failed: HTTP ' . $status . ' ' . json_encode($codeResponse)
);
$onboardingCode = (string)$codeResponse['data']['onboarding_code'];
expect_ok(preg_match('/^[A-HJ-NP-Z2-9]{12}$/', $onboardingCode) === 1, 'Admin onboarding code has invalid format.');

[$status, $requestResponse, $requestCookie] = req('POST', $base . '/onboarding/request', [
    'onboarding_code' => $onboardingCode,
    'full_name' => 'HTTP Onboarding Teacher',
    'employee_id' => 'HTTP-ONB-001',
    'phone' => '+212600000123',
]);
expect_ok($status === 201 && ($requestResponse['success'] ?? false) === true, 'Public onboarding request failed.');
$requestToken = (string)$requestResponse['data']['request_token'];
expect_ok(strlen($requestToken) === 64, 'Public onboarding request token has invalid length.');

[$status, $statusResponse] = req('GET', $base . '/onboarding/status?request_token=' . rawurlencode($requestToken));
expect_ok($status === 200 && $statusResponse['data']['status'] === 'pending', 'Pending onboarding status is incorrect.');

[$status, $listResponse] = req('GET', $base . '/admin/onboarding/requests', null, $adminCookie);
expect_ok($status === 200 && ($listResponse['data']['requests'][0]['status'] ?? '') === 'pending', 'Admin onboarding request list did not show the pending request.');

[$status, $reviewResponse] = req('POST', $base . '/admin/onboarding/' . (int)$requestResponse['data']['request_id'] . '/review', [
    'decision' => 'approve',
], $adminCookie, $adminCsrf);
expect_ok($status === 200 && ($reviewResponse['data']['status'] ?? '') === 'approved', 'Admin onboarding approval failed.');

[$status, $statusResponse] = req('GET', $base . '/onboarding/status?request_token=' . rawurlencode($requestToken));
expect_ok($status === 200 && $statusResponse['data']['status'] === 'approved' && $statusResponse['data']['activated'] === false, 'Approved onboarding status is incorrect before activation.');

[$status, $activationResponse] = req('POST', $base . '/onboarding/activate', [
    'request_token' => $requestToken,
    'password' => 'TeacherActivate123!',
]);
expect_ok($status === 200 && ($activationResponse['success'] ?? false) === true, 'Public onboarding activation failed.');
$newCode = (string)$activationResponse['data']['sams_code'];
expect_ok(preg_match('/^T[0-9]{6}$/', $newCode) === 1, 'Activation did not return a teacher SAMS Code.');

[$status, $finalSession, $anonCookie] = req('GET', $base . '/auth/session');
$anonCsrf = (string)$finalSession['data']['csrf'];
[$status, $teacherLogin] = req('POST', $base . '/auth/login', [
    'sams_code' => $newCode,
    'password' => 'TeacherActivate123!',
], $anonCookie, $anonCsrf);
expect_ok($status === 200 && ($teacherLogin['data']['user']['role'] ?? '') === 'teacher', 'Activated teacher SAMS Code could not authenticate over HTTP.');

[$status, $secondActivation] = req('POST', $base . '/onboarding/activate', [
    'request_token' => $requestToken,
    'password' => 'TeacherActivate123!',
]);
expect_ok($status === 409, 'Activated onboarding request could be replayed.');

echo "[PASS] Canonical onboarding HTTP flow: code rotation, public request, status, admin approval, activation, initial SAMS Code login, and replay protection verified." . PHP_EOL;
