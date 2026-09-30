import { test, expect } from '@playwright/test';

const adminCode = process.env.SAMS_E2E_ADMIN_SAMS_CODE;
const adminPassword = process.env.SAMS_E2E_PASSWORD;

function v1Url(path) {
  return new URL(`/api/v1${path}`, 'http://localhost').pathname;
}

async function requestJson(page, method, path, body = null, csrf = null) {
  return page.evaluate(async ({ method, path, body, csrf }) => {
    const headers = { Accept: 'application/json' };
    if (body !== null) headers['Content-Type'] = 'application/json';
    if (csrf) headers['X-CSRF-Token'] = csrf;
    const response = await fetch(path, {
      method,
      credentials: 'include',
      headers,
      body: body === null ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }, { method, path: v1Url(path), body, csrf });
}

async function authSession(page) {
  const response = await requestJson(page, 'GET', '/auth/session');
  expect(response.status).toBe(200);
  return response.body.data;
}

test('teacher onboarding completes from public request through activation', async ({ page }) => {
  expect(adminCode).toMatch(/^A[0-9]{6}$/);
  expect(adminPassword).toBeTruthy();

  await page.goto('login.php');
  const anonymous = await authSession(page);
  const adminLogin = await requestJson(page, 'POST', '/auth/login', {
    sams_code: adminCode,
    password: adminPassword,
  }, anonymous.csrf);
  expect(adminLogin.status).toBe(200);
  expect(adminLogin.body.data.user.role).toBe('admin');
  const adminCsrf = adminLogin.body.data.csrf;

  const codeResponse = await requestJson(page, 'POST', '/admin/onboarding/code', {
    action: 'code',
  }, adminCsrf);
  expect(codeResponse.status).toBe(200);
  const onboardingCode = codeResponse.body.data.onboarding_code;
  expect(onboardingCode).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);

  const requestResponse = await requestJson(page, 'POST', '/onboarding/request', {
    onboarding_code: onboardingCode,
    full_name: 'E2E Onboarding Teacher',
    employee_id: 'E2E-ONB-001',
    phone: '+212600000321',
  });
  expect(requestResponse.status).toBe(201);
  const requestId = requestResponse.body.data.request_id;
  const requestToken = requestResponse.body.data.request_token;
  expect(requestToken).toMatch(/^[a-f0-9]{64}$/);

  const listResponse = await requestJson(page, 'GET', '/admin/onboarding/requests', null, null);
  expect(listResponse.status).toBe(200);
  const listed = listResponse.body.data.requests.find((row) => Number(row.id) === Number(requestId));
  expect(listed).toBeTruthy();
  expect(listed.status).toBe('pending');
  expect(listed.request_token_hash).toBeUndefined();
  expect(listed.request_token).toBeUndefined();

  const approval = await requestJson(page, 'POST', `/admin/onboarding/${requestId}/review`, {
    decision: 'approve',
  }, adminCsrf);
  expect(approval.status).toBe(200);
  expect(approval.body.data.status).toBe('approved');
  expect(Number(approval.body.data.user_id)).toBeGreaterThan(0);

  const activation = await requestJson(page, 'POST', '/onboarding/activate', {
    request_token: requestToken,
    password: 'E2E-Onboarding-Password-2026!'
  });
  expect(activation.status).toBe(200);
  const teacherCode = activation.body.data.sams_code;
  expect(teacherCode).toMatch(/^T[0-9]{6}$/);

  const fresh = await authSession(page);
  const teacherLogin = await requestJson(page, 'POST', '/auth/login', {
    sams_code: teacherCode,
    password: 'E2E-Onboarding-Password-2026!'
  }, fresh.csrf);
  expect(teacherLogin.status).toBe(200);
  expect(teacherLogin.body.data.user.role).toBe('teacher');

  const replay = await requestJson(page, 'POST', '/onboarding/activate', {
    request_token: requestToken,
    password: 'E2E-Onboarding-Password-2026!'
  });
  expect(replay.status).toBe(409);
});
