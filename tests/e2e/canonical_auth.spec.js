import { test, expect } from '@playwright/test';

const adminCode = process.env.SAMS_E2E_ADMIN_SAMS_CODE;
const teacherCode = process.env.SAMS_E2E_TEACHER_SAMS_CODE;
const adminPassword = process.env.SAMS_E2E_PASSWORD;
const teacherPassword = process.env.SAMS_E2E_TEACHER_PASSWORD;
const teacherId = Number(process.env.SAMS_E2E_TEACHER_ID || 0);

function authUrl(page, action) {
  return new URL(`/api/v1/auth/${action}`, page.url()).toString();
}

async function readSession(page) {
  const response = await page.evaluate(async (url) => {
    const res = await fetch(url, { credentials: 'include' });
    return { status: res.status, body: await res.json() };
  }, authUrl(page, 'session'));

  expect(response.status).toBe(200);
  return response.body;
}

async function postJson(page, url, body, csrf) {
  return page.evaluate(async ({ url, body, csrf }) => {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }, { url, body, csrf });
}

async function canonicalLogin(page, samsCode, password) {
  const session = await readSession(page);
  const csrf = session.data.csrf;
  const cookies = await page.context().cookies();
  const response = await postJson(page, authUrl(page, 'login'), {
    sams_code: samsCode,
    password,
  }, csrf);

  if (response.status !== 200) {
    throw new Error(`Canonical login failed: HTTP ${response.status} ${JSON.stringify(response.body)} cookies=${JSON.stringify(cookies)} csrf=${csrf}`);
  }
  expect(response.body.success).toBe(true);
  expect(response.body.data.user.school_id).toBeTruthy();
  expect(response.body.data.user.password_hash).toBeUndefined();
  return response.body.data.csrf;
}

test.beforeAll(() => {
  if (![adminCode, teacherCode, adminPassword, teacherPassword].every(Boolean) || teacherId < 1) {
    throw new Error('Canonical Auth E2E fixture environment is incomplete.');
  }
});

test.describe.serial('Canonical authentication', () => {
  test('SAMS Code login persists session and logout invalidates it', async ({ page }) => {
    await page.goto('login.php');

    const csrf = await canonicalLogin(page, teacherCode, teacherPassword);
    await page.goto('index.php');
    await expect(page.locator('#logoutBtn')).toBeVisible();

    const session = await readSession(page);
    expect(session.data.authenticated).toBe(true);
    expect(session.data.user.role).toBe('teacher');

    const logout = await postJson(page, authUrl(page, 'logout'), {}, csrf);
    expect(logout.status).toBe(200);
    expect(logout.body.success).toBe(true);

    const afterLogout = await readSession(page);
    expect(afterLogout.data.authenticated).toBe(false);
    await page.goto('index.php');
    await expect(page).toHaveURL(/login\.php$/);
  });

  test('admin reissue revokes old code and new code authenticates', async ({ page }) => {
    await page.goto('login.php');
    const adminCsrf = await canonicalLogin(page, adminCode, adminPassword);
    await page.goto('index.php');

    expect(teacherId).toBeGreaterThan(0);

    const reissue = await postJson(page, new URL('/api/v1/admin/users', page.url()).toString(), {
      action: 'reissue_sams_code',
      id: teacherId,
    }, adminCsrf);

    expect(reissue.status).toBe(200);
    expect(reissue.body.success).toBe(true);
    const newCode = reissue.body.data.sams_code;
    expect(newCode).toMatch(/^T[0-9]{6}$/);
    expect(newCode).not.toBe(teacherCode);

    const logout = await postJson(page, authUrl(page, 'logout'), {}, adminCsrf);
    expect(logout.status).toBe(200);

    await page.goto('login.php');
    const anonymousSession = await readSession(page);
    const oldLogin = await postJson(page, authUrl(page, 'login'), {
      sams_code: teacherCode,
      password: teacherPassword,
    }, anonymousSession.data.csrf);
    expect(oldLogin.status).toBe(401);

    await page.goto('login.php');
    const fresh = await readSession(page);
    const newLogin = await postJson(page, authUrl(page, 'login'), {
      sams_code: newCode,
      password: teacherPassword,
    }, fresh.data.csrf);
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.success).toBe(true);
    expect(newLogin.body.data.user.role).toBe('teacher');
  });
});
