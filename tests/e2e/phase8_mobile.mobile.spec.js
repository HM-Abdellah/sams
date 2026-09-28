import { test, expect } from '@playwright/test';

const adminUsername = process.env.SAMS_E2E_USERNAME;
const adminPassword = process.env.SAMS_E2E_PASSWORD;
const teacherUsername = process.env.SAMS_E2E_TEACHER_USERNAME;
const teacherPassword = process.env.SAMS_E2E_TEACHER_PASSWORD;

test.beforeAll(() => {
  if (![adminUsername, adminPassword, teacherUsername, teacherPassword].every(Boolean)) {
    throw new Error('Phase 8 mobile fixture environment is incomplete.');
  }
});

async function login(page, user, pass) {
  await page.goto('login.php');
  await page.locator('#username').fill(user);
  await page.locator('#password').fill(pass);
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/auth.php?action=login') && response.request().method() === 'POST'
  );
  await page.locator('#loginBtn').click();
  const response = await responsePromise;
  if (!response.ok()) throw new Error(`Login API failed: HTTP ${response.status()}`);
  await page.waitForURL(/index\.php$/);
}

async function setWeek(page, weekStart) {
  const attendanceResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/attendance.php?class_id=') &&
      response.url().includes('week_start=' + weekStart) &&
      response.request().method() === 'GET'
  );
  const signoffResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/attendance-signoffs.php?class_id=') &&
      response.url().includes('week_start=' + weekStart) &&
      response.request().method() === 'GET'
  );

  await page.locator('#weekStart').fill(weekStart);
  await page.locator('#weekStart').press('Tab');
  await Promise.all([attendanceResponse, signoffResponse]);
  await expect(page.locator('#weekStart')).toHaveValue(weekStart);
}

async function logout(page) {
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/auth.php?action=logout') && response.request().method() === 'POST'
  );
  await page.locator('#logoutBtn').click();
  await responsePromise;
  await page.waitForURL(/login\.php$/);
}

test.describe('Phase 8 mobile authenticated journeys', () => {
  test('unauthenticated dashboard access redirects to login on mobile', async ({ page }) => {
    await page.goto('index.php');
    await expect(page).toHaveURL(/login\.php$/);
    await expect(page.locator('#loginForm')).toBeVisible();
  });

  test('teacher mobile attendance is real, synchronized and persists after reload', async ({ page }) => {
    await login(page, teacherUsername, teacherPassword);
    await expect(page.locator('#attendanceMobileList')).toBeVisible();
    await expect(page.locator('#classSelect option:not([disabled])')).toHaveCount(1);
    await expect(page.locator('#weekDays .week-day-btn')).toHaveCount(6);
    await expect(page.locator('#periods .period-btn')).toHaveCount(8);
    await expect.poll(
      async () => page.locator('#attendanceMobileList .attendance-student-card').count()
    ).toBeGreaterThanOrEqual(3);

    await setWeek(page, '2026-10-05');
    await page.locator('#weekDays .week-day-btn').nth(1).click();
    await page.locator('#periods [data-select-period="7"]').click();
    const toggle = page.locator('#attendanceMobileList [data-attendance-toggle]').first();
    await expect(toggle).toHaveText('');

    const bulkResponse = page.waitForResponse(
      (response) => response.url().includes('/api/attendance.php') && response.request().method() === 'POST'
    );
    await toggle.click();

    const response = await bulkResponse;
    expect(response.ok()).toBeTruthy();
    const requestBody = response.request().postDataJSON();
    expect(requestBody?.action).toBe('bulk');
    expect(requestBody?.entries).toHaveLength(1);
    expect(requestBody.entries[0]?.status).toBe('absent');

    await page.reload();
    await expect(page.locator('#attendanceMobileList [data-attendance-toggle]').first()).toHaveText('X');
  });

  test('teacher mobile signature workflow supports correction and weekly certification', async ({ page }) => {
    await login(page, teacherUsername, teacherPassword);

    await setWeek(page, '2026-10-12');
    await page.locator('#weekDays .week-day-btn').nth(5).click();
    await page.locator('#periods [data-select-period="7"]').click();

    const toggle = page.locator('#attendanceMobileList [data-attendance-toggle]').first();
    await expect(toggle).toBeVisible();

    const bulkResponse = page.waitForResponse(
      (response) => response.url().includes('/api/attendance.php') && response.request().method() === 'POST'
    );
    await toggle.click();
    await bulkResponse;

    await page.locator('#attendanceWorkflow [data-sign-period]').click();
    await expect(page.locator('#attendanceWorkflow .attendance-seal')).toContainText(/Validée par|Certified by|تمت المصادقة/);
    await expect(toggle).toBeDisabled();

    await page.locator('#attendanceWorkflow [data-reopen-period]').click();
    await expect(page.locator('#attendanceWorkflow .attendance-seal')).toContainText(/Correction|re-sign|إعادة/);

    const correctionResponse = page.waitForResponse(
      (response) => response.url().includes('/api/attendance.php') && response.request().method() === 'POST'
    );
    await toggle.click();
    await correctionResponse;

    await page.locator('#attendanceWorkflow [data-sign-period]').click();
    await page.locator('#weeklyTeacherSignatures [data-sign-week]').click();
    await expect(page.locator('#weeklyTeacherSignatures .weekly-teacher-status.signed')).toHaveCount(1);
    await expect(page.locator('#weeklyTeacherSignatures')).toContainText('1/1');
  });

  test('admin mobile console remains usable after authenticated navigation', async ({ page }) => {
    await login(page, adminUsername, adminPassword);
    await page.locator('.tab[data-tab="admin"]').click();
    await expect(page.locator('#dashboardPulse')).toBeVisible();
    await expect(page.locator('#adminClassesTable')).toBeVisible();
    await expect(page.locator('#usersTable')).toBeVisible();
    await expect(page.locator('#academicYearsTable')).toBeVisible();
    await expect(page.locator('#importsTable')).toBeVisible();
  });

  test('logout removes mobile access to protected dashboard', async ({ page }) => {
    await login(page, teacherUsername, teacherPassword);
    await logout(page);
    await page.goto('index.php');
    await expect(page).toHaveURL(/login\.php$/);
  });
});
