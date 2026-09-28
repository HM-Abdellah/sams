import { test, expect } from '@playwright/test';

const adminUsername = process.env.SAMS_E2E_USERNAME;
const adminPassword = process.env.SAMS_E2E_PASSWORD;
const teacherUsername = process.env.SAMS_E2E_TEACHER_USERNAME;
const teacherPassword = process.env.SAMS_E2E_TEACHER_PASSWORD;

test.beforeAll(() => {
  if (![adminUsername, adminPassword, teacherUsername, teacherPassword].every(Boolean)) {
    throw new Error('Phase 8 admin fixture environment is incomplete.');
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
  if (!response.ok()) throw new Error(\`Login API failed: HTTP \${response.status()}\`);
  await page.waitForURL(/index\.php$/);
}

async function logout(page) {
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/auth.php?action=logout') && response.request().method() === 'POST'
  );
  await page.locator('#logoutBtn').click();
  await responsePromise;
  await page.waitForURL(/login\.php$/);
}

test.describe.serial('Phase 8 administration journeys', () => {
  test('student create, update and deactivate lifecycle is server-backed', async ({ page }) => {
    await login(page, adminUsername, adminPassword);
    await page.locator('.tab[data-tab="students"]').click();

    await page.locator('#addStudentBtn').click();
    await page.locator('#firstNameInput').fill('E2E Lifecycle');
    await page.locator('#lastNameInput').fill('Student');
    await page.locator('#massarInput').fill('E2ELIFE001');
    await page.locator('#birthDateInput').fill('2010-09-09');
    await page.locator('#studentNumberInput').fill('A099');

    const createResponse = page.waitForResponse(
      (response) => response.url().includes('/api/students.php') && response.request().method() === 'POST'
    );
    await page.locator('#studentForm button[type="submit"]').click();
    expect((await createResponse).ok()).toBeTruthy();

    let card = page.locator('#studentsList .student-card').filter({ hasText: 'E2ELIFE001' }).first();
    await expect(card).toBeVisible();

    await card.locator('[data-edit-student]').click();
    await page.locator('#editFirstNameInput').fill('E2E Updated');

    const updateResponse = page.waitForResponse(
      (response) => response.url().includes('/api/students.php') && response.request().method() === 'POST'
    );
    await page.locator('#editStudentForm button[type="submit"]').click();
    expect((await updateResponse).ok()).toBeTruthy();
    await expect(page.locator('#studentsList .student-card').filter({ hasText: 'E2E Updated' })).toHaveCount(1);

    page.once('dialog', (dialog) => dialog.accept());
    const deactivateResponse = page.waitForResponse(
      (response) => response.url().includes('/api/students.php') && response.request().method() === 'POST'
    );
    await page.locator('#studentsList .student-card').filter({ hasText: 'E2ELIFE001' }).first().locator('[data-delete-student]').click();
    expect((await deactivateResponse).ok()).toBeTruthy();
    await expect(page.locator('#studentsList .student-card').filter({ hasText: 'E2ELIFE001' })).toHaveCount(0);
    await logout(page);
  });

  test('teacher assignment changes access and can be restored', async ({ page }) => {
    await login(page, adminUsername, adminPassword);
    await page.locator('#classSelect').selectOption({ label: 'E2E-2BAC-A' });
    await page.locator('.tab[data-tab="admin"]').click();

    let row = page.locator('#assignmentsTable tbody tr').filter({ hasText: 'E2E Teacher' }).first();
    await expect(row).toBeVisible();

    const removeA = page.waitForResponse(
      (response) => response.url().includes('/api/teacher-classes.php') && response.request().method() === 'DELETE'
    );
    await row.locator('[data-unassign-teacher]').click();
    expect((await removeA).ok()).toBeTruthy();

    await page.locator('#assignmentTeacherInput').selectOption({ label: /E2E Teacher/ });
    await page.locator('#assignmentClassInput').selectOption({ label: /E2E-2BAC-B/ });

    const assignB = page.waitForResponse(
      (response) => response.url().includes('/api/teacher-classes.php') && response.request().method() === 'POST'
    );
    await page.locator('#assignmentForm button[type="submit"]').click();
    expect((await assignB).ok()).toBeTruthy();

    await logout(page);
    await login(page, teacherUsername, teacherPassword);
    await expect(page.locator('#classSelect option:not([disabled])')).toHaveCount(1);
    await expect(page.locator('#classSelect option:checked')).toContainText('E2E-2BAC-B');
    await logout(page);

    await login(page, adminUsername, adminPassword);
    await page.locator('#classSelect').selectOption({ label: 'E2E-2BAC-A' });
    await page.locator('.tab[data-tab="admin"]').click();

    await page.locator('#assignmentTeacherInput').selectOption({ label: /E2E Teacher/ });
    await page.locator('#assignmentClassInput').selectOption({ label: /E2E-2BAC-A/ });
    const restoreA = page.waitForResponse(
      (response) => response.url().includes('/api/teacher-classes.php') && response.request().method() === 'POST'
    );
    await page.locator('#assignmentForm button[type="submit"]').click();
    expect((await restoreA).ok()).toBeTruthy();

    await page.locator('#classSelect').selectOption({ label: 'E2E-2BAC-B' });
    await page.locator('.tab[data-tab="admin"]').click();
    row = page.locator('#assignmentsTable tbody tr').filter({ hasText: 'E2E Teacher' }).first();
    const removeB = page.waitForResponse(
      (response) => response.url().includes('/api/teacher-classes.php') && response.request().method() === 'DELETE'
    );
    await row.locator('[data-unassign-teacher]').click();
    expect((await removeB).ok()).toBeTruthy();
    await logout(page);

    await login(page, teacherUsername, teacherPassword);
    await expect(page.locator('#classSelect option:not([disabled])')).toHaveCount(1);
    await expect(page.locator('#classSelect option:checked')).toContainText('E2E-2BAC-A');
    await logout(page);
  });

  test('academic-year creation and activation change operational visibility', async ({ page }) => {
    await login(page, adminUsername, adminPassword);
    await page.locator('.tab[data-tab="admin"]').click();

    await page.locator('#academicYearNameInput').fill('2027/2028');
    await page.locator('#academicYearStartInput').fill('2027-09-01');
    await page.locator('#academicYearEndInput').fill('2028-07-31');
    await page.locator('#academicYearActivateInput').selectOption('0');

    const createYear = page.waitForResponse(
      (response) => response.url().includes('/api/academic-years.php') && response.request().method() === 'POST'
    );
    await page.locator('#academicYearForm button[type="submit"]').click();
    expect((await createYear).ok()).toBeTruthy();

    let row = page.locator('#academicYearsTable tbody tr').filter({ hasText: '2027/2028' }).first();
    await expect(row).toBeVisible();
    await expect(row.locator('td').nth(3)).toHaveText('Non');

    const activateFuture = page.waitForResponse(
      (response) => response.url().includes('/api/academic-years.php') && response.request().method() === 'POST'
    );
    await row.locator('[data-activate-year]').click();
    expect((await activateFuture).ok()).toBeTruthy();

    row = page.locator('#academicYearsTable tbody tr').filter({ hasText: '2027/2028' }).first();
    await expect(row.locator('td').nth(3)).toHaveText('Oui');
    await expect(page.locator('#classSelect option:not([disabled])')).toHaveCount(0);

    row = page.locator('#academicYearsTable tbody tr').filter({ hasText: '2026/2027' }).first();
    const reactivateCurrent = page.waitForResponse(
      (response) => response.url().includes('/api/academic-years.php') && response.request().method() === 'POST'
    );
    await row.locator('[data-activate-year]').click();
    expect((await reactivateCurrent).ok()).toBeTruthy();
    await expect(page.locator('#classSelect option:not([disabled])')).toHaveCount(2);

    await logout(page);
  });
});
