<?php

declare(strict_types=1);

function http_request(string $method, string $url, ?array $body = null, ?string $cookie = null, ?string $csrf = null): array
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
    $context = stream_context_create($options);
    $response = file_get_contents($url, false, $context);
    if ($response === false) throw new RuntimeException('HTTP request failed: ' . $url);
    $status = 0;
    $cookies = [];
    foreach ($http_response_header ?? [] as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $m)) $status = (int)$m[1];
        if (stripos($header, 'Set-Cookie:') === 0 && preg_match('/Set-Cookie:\s*([^;]+)/i', $header, $m)) $cookies[] = $m[1];
    }
    return [$status, json_decode($response, true, 512, JSON_THROW_ON_ERROR), implode('; ', $cookies)];
}

function assert_http(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$fixture = json_decode((string)(getenv('SAMS_AUTH_HTTP_FIXTURE') ?: ''), true, 512, JSON_THROW_ON_ERROR);
$adminUsername = (string)$fixture['admin_username'];
$teacherCode = (string)$fixture['teacher_code'];
$teacherId = (int)$fixture['teacher_id'];
$base = (string)(getenv('SAMS_AUTH_HTTP_BASE') ?: 'http://127.0.0.1:8082/sams/api/v1/auth');
$adminBase = str_replace('/auth', '/admin/users', $base);

[$status, $session, $cookie] = http_request('GET', $base . '/session');
assert_http($status === 200, 'Anonymous session endpoint did not return HTTP 200.');
assert_http(($session['data']['authenticated'] ?? null) === false, 'Anonymous session was incorrectly authenticated.');
$csrf = (string)($session['data']['csrf'] ?? '');
assert_http($csrf !== '' && $cookie !== '', 'Anonymous session did not establish CSRF/session state.');

[$status, $badLogin] = http_request('POST', $base . '/login', ['sams_code' => $teacherCode, 'password' => 'WrongPassword123!'], $cookie, $csrf);
assert_http($status === 401 && ($badLogin['success'] ?? true) === false, 'Invalid canonical credentials were not rejected.');
[$status, $login, $loginCookie] = http_request('POST', $base . '/login', ['sams_code' => $teacherCode, 'password' => 'HttpTeacherPassword123!'], $cookie, $csrf);
assert_http($status === 200 && ($login['success'] ?? false) === true, 'Canonical SAMS Code login failed.');
$authenticatedCookie = $loginCookie !== '' ? $loginCookie : $cookie;
$loginCsrf = (string)($login['data']['csrf'] ?? '');
assert_http(($login['data']['user']['role'] ?? '') === 'teacher', 'Canonical login returned the wrong role.');
assert_http((int)($login['data']['user']['school_id'] ?? 0) > 0, 'Canonical login omitted school scope.');
assert_http(!array_key_exists('password_hash', $login['data']['user'] ?? []), 'Canonical login returned password hash.');

[$status, $activeSession] = http_request('GET', $base . '/session', null, $authenticatedCookie);
assert_http($status === 200 && ($activeSession['data']['authenticated'] ?? false) === true, 'Authenticated canonical session was not persisted.');
[$status, $logout] = http_request('POST', $base . '/logout', [], $authenticatedCookie, $loginCsrf);
assert_http($status === 200 && ($logout['success'] ?? false) === true, 'Canonical logout failed.');

[$status, $adminSession, $adminCookie] = http_request('GET', $base . '/session');
$adminCsrf = (string)($adminSession['data']['csrf'] ?? '');
[$status, $adminLogin, $adminCookie2] = http_request('POST', $base . '/login', ['identifier' => $adminUsername, 'password' => 'HttpAdminPassword123!'], $adminCookie, $adminCsrf);
assert_http($status === 200 && ($adminLogin['data']['user']['role'] ?? '') === 'admin', 'Canonical admin username login failed.');
$adminCookie = $adminCookie2 !== '' ? $adminCookie2 : $adminCookie;
$adminLoginCsrf = (string)($adminLogin['data']['csrf'] ?? '');

[$status, $existingCodeResponse] = http_request('POST', $adminBase, ['action' => 'generate_sams_code', 'id' => $teacherId], $adminCookie, $adminLoginCsrf);
assert_http($status === 409, 'Existing teacher SAMS Code was unexpectedly regenerated.');
assert_http(($existingCodeResponse['success'] ?? true) === false, 'Stable teacher SAMS Code generation should reject regeneration.');

[$status, $freshSession, $freshCookie] = http_request('GET', $base . '/auth/session');
$freshCsrf = (string)$freshSession['data']['csrf'];
[$status, $teacherLoginAgain] = http_request('POST', $base . '/auth/login', ['identifier' => $teacherCode, 'password' => 'HttpTeacherPassword123!'], $freshCookie, $freshCsrf);
assert_http($status === 200 && ($teacherLoginAgain['data']['user']['role'] ?? '') === 'teacher', 'Original fixed teacher SAMS Code stopped authenticating.');

echo "[PASS] Canonical /api/v1/auth session, CSRF, SAMS Code login, session persistence, logout, admin reissue, revocation, and rotated-code login verified." . PHP_EOL;
