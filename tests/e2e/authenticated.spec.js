import { test, expect } from '@playwright/test';

const username = process.env.SAMS_E2E_USERNAME;
const password = process.env.SAMS_E2E_PASSWORD;
const teacherUsername = process.env.SAMS_E2E_TEACHER_USERNAME;
const teacherPassword = process.env.SAMS_E2E_TEACHER_PASSWORD;

test.describe('authenticated SAMS smoke', () => {
  test.skip(!username || !password, 'Set SAMS_E2E_USERNAME and SAMS_E2E_PASSWORD to run authenticated E2E tests.');

  test('login, operational roster and archive are reachable', async ({ page }) => {
    await page.goto('/login.php');
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('#loginForm').evaluate((form) => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await page.waitForURL(/index\.php$/);
    await expect(page.locator('#classSelect')).toBeVisible();
    await expect(page.locator('#attendanceBody')).toBeVisible();

    const classCount = await page.locator('#classSelect option:not([disabled])').count();
    expect(classCount).toBeGreaterThan(0);

    await page.locator('.tab[data-tab="archive"]').click();
    await expect(page.locator('[data-panel="archive"]')).toBeVisible();
    await page.locator('#loadArchiveBtn').click();
    await expect(page.locator('#archiveTable')).toBeVisible();
    await expect(page.locator('[data-archive-day]').first()).toBeVisible();

    await page.locator('[data-archive-day]').first().click();
    await expect(page.locator('#archiveDayDialog')).toBeVisible();
    await page.locator('[data-close-dialog="archiveDayDialog"]').click();

    await page.locator('[data-archive-view="month"]').click();
    await expect(page.locator('[data-student-history]').first()).toBeVisible();
    await page.locator('[data-student-history]').first().click();
    await expect(page.locator('#studentHistoryDialog')).toBeVisible();
    await page.locator('[data-close-dialog="studentHistoryDialog"]').click();

    const adminTab = page.locator('.tab[data-tab="admin"]');
    if (await adminTab.count()) {
      await adminTab.click();
      await expect(page.locator('#userForm')).toBeVisible();
      await expect(page.locator('#assignmentForm')).toBeVisible();
      await expect(page.locator('#importForm')).toBeVisible();
    }
  });

  test('attendance edits are sent as one bulk request', async ({ page }) => {
    const batches = [];

    await page.route('**/api/attendance.php*', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      const body = route.request().postDataJSON();
      batches.push(body);

      const total = Array.isArray(body?.entries) ? body.entries.length : 0;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { changed: total, unchanged: 0, total }
        })
      });
    });

    await page.goto('/login.php');
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('#loginForm').evaluate((form) => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await page.waitForURL(/index\.php$/);
    await expect(page.locator('.attendance-cell').first()).toBeVisible();

    await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.attendance-cell')].slice(0, 3);
      cells.forEach((cell) => cell.click());
    });

    await page.waitForTimeout(800);

    expect(batches).toHaveLength(1);
    expect(batches[0]?.action).toBe('bulk');
    expect(batches[0]?.entries).toHaveLength(3);
    expect(batches[0].entries.every((entry) => ['upsert', 'delete'].includes(entry.action))).toBe(true);
  });

  test('teacher sees only assigned classes', async ({ page }) => {
    test.skip(!teacherUsername || !teacherPassword, 'Set teacher E2E credentials to run teacher isolation tests.');

    await page.goto('/login.php');
    await page.locator('#username').fill(teacherUsername);
    await page.locator('#password').fill(teacherPassword);
    await page.locator('#loginForm').evaluate((form) => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await page.waitForURL(/index\.php$/);
    await expect(page.locator('#attendanceBody')).toBeVisible();
    await expect(page.locator('#classSelect option:not([disabled])')).toHaveCount(1);
    await expect(page.locator('.tab[data-tab="admin"]')).toHaveCount(0);
  });

  test('admin can manage a class and a user through the UI', async ({ page }) => {
    await page.goto('/login.php');
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('#loginForm').evaluate((form) => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await page.waitForURL(/index\.php$/);
    await page.locator('.tab[data-tab="admin"]').click();
    await expect(page.locator('#adminClassesTable')).toBeVisible();

    const className = 'E2E-UI-' + Date.now();
    await page.locator('#addClassBtn').click();
    await page.locator('#classNameInput').fill(className);
    await page.locator('#classLevelInput').fill('2BAC');
    await page.locator('#classBranchInput').fill('SP');
    await page.locator('#classForm button[type="submit"]').click();

    await page.locator('.tab[data-tab="admin"]').click();
    const classRow = page.locator('#adminClassesTable tbody tr').filter({ hasText: className }).first();
    await expect(classRow).toBeVisible();

    await classRow.locator('[data-edit-class]').click();
    await page.locator('#editClassNameInput').fill(className + '-EDITED');
    await page.locator('#editClassForm button[type="submit"]').click();

    await page.locator('.tab[data-tab="admin"]').click();
    const editedClassRow = page.locator('#adminClassesTable tbody tr').filter({ hasText: className + '-EDITED' }).first();
    await expect(editedClassRow).toBeVisible();

    await editedClassRow.locator('[data-toggle-class]').click();
    await expect(editedClassRow.locator('td').nth(4)).toHaveText('Non');

    await editedClassRow.locator('[data-toggle-class]').click();
    await expect(editedClassRow.locator('td').nth(4)).toHaveText('Oui');

    const createdUsername = 'e2e-ui-' + Date.now();
    const newPassword = 'e2e-ui-password-2026';

    await page.locator('#userUsernameInput').fill(createdUsername);
    await page.locator('#userFullNameInput').fill('E2E UI User');
    await page.locator('#userRoleInput').selectOption('teacher');
    await page.locator('#userPasswordInput').fill(newPassword);
    await page.locator('#userForm button[type="submit"]').click();

    await expect(page.locator('#usersTable tbody tr').filter({ hasText: createdUsername }).first()).toBeVisible();
    const userRow = page.locator('#usersTable tbody tr').filter({ hasText: createdUsername }).first();

    await userRow.locator('[data-edit-user]').click();
    await page.locator('#editUserFullNameInput').fill('E2E UI User Edited');
    await page.locator('#editUserForm button[type="submit"]').click();

    await page.locator('.tab[data-tab="admin"]').click();
    const editedUserRow = page.locator('#usersTable tbody tr').filter({ hasText: createdUsername }).first();
    await editedUserRow.locator('[data-reset-user]').click();
    await page.locator('#resetUserPasswordInput').fill('e2e-ui-password-reset-2026');
    await page.locator('#resetUserPasswordForm button[type="submit"]').click();

    await page.locator('.tab[data-tab="admin"]').click();
    await editedUserRow.locator('[data-toggle-user]').click();
    await expect(editedUserRow.locator('td').nth(3)).toHaveText('Non');
  });

  test('logout invalidates the authenticated browser session', async ({ page }) => {
    await page.goto('/login.php');
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('#loginForm').evaluate((form) => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await page.waitForURL(/index\.php$/);
    await page.locator('#logoutBtn').click();
    await page.waitForURL(/login\.php$/);

    await page.goto('/index.php');
    await expect(page).toHaveURL(/login\.php$/);
  });
});
