import { test, expect } from '@playwright/test';

const adminUsername = process.env.SAMS_E2E_USERNAME;
const adminPassword = process.env.SAMS_E2E_PASSWORD;
const lifecycleUsername = process.env.SAMS_E2E_LIFECYCLE_USERNAME;
const lifecyclePassword = process.env.SAMS_E2E_LIFECYCLE_PASSWORD;
const lifecycleResetPassword = process.env.SAMS_E2E_LIFECYCLE_RESET_PASSWORD;

test.beforeAll(() => {
  if (![adminUsername, adminPassword, lifecycleUsername, lifecyclePassword, lifecycleResetPassword].every(Boolean)) {
    throw new Error('Phase 8 authentication fixture environment is incomplete.');
  }
});

async function login(page, user, pass, { waitForRoster = false } = {}) {
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
  if (waitForRoster) {
    await expect.poll(
      async () => page.locator('#classSelect option:not([disabled])').count()
    ).toBeGreaterThan(0);
  }
}

async function expectLoginFailure(page, user, pass) {
  await page.goto('login.php');
  await page.locator('#username').fill(user);
  await page.locator('#password').fill(pass);
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/auth.php?action=login') && response.request().method() === 'POST'
  );
  await page.locator('#loginBtn').click();
  const response = await responsePromise;
  expect(response.ok()).toBeFalsy();
  await expect(page.locator('#loginError')).toBeVisible();
  await expect(page.locator('#loginError')).not.toHaveText('');
  await expect(page).toHaveURL(/login\.php$/);
}

async function logout(page) {
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/auth.php?action=logout') && response.request().method() === 'POST'
  );
  await page.locator('#logoutBtn').click();
  await responsePromise;
  await page.waitForURL(/login\.php$/);
}

test.describe.serial('Phase 8 authentication lifecycle', () => {
  test('wrong credentials are rejected', async ({ page }) => {
    await expectLoginFailure(page, adminUsername, adminPassword + '-wrong');
  });

  test('user creation, password reset, lock, unlock and inactive-account rejection are real flows', async ({ page }) => {
    await login(page, adminUsername, adminPassword, { waitForRoster: true });
    await page.locator('.tab[data-tab="admin"]').click();

    await page.locator('#userUsernameInput').fill(lifecycleUsername);
    await page.locator('#userFullNameInput').fill('E2E Lifecycle User');
    await page.locator('#userRoleInput').selectOption('teacher');
    await page.locator('#userPasswordInput').fill(lifecyclePassword);

    const createResponse = page.waitForResponse(
      (response) => response.url().includes('/api/users.php') && response.request().method() === 'POST'
    );
    await page.locator('#userForm button[type="submit"]').click();
    expect((await createResponse).ok()).toBeTruthy();

    const userRow = page.locator('#usersTable tbody tr').filter({ hasText: lifecycleUsername }).first();
    await expect(userRow).toBeVisible();

    await userRow.locator('[data-reset-user]').click();
    await page.locator('#resetUserPasswordInput').fill(lifecycleResetPassword);

    const resetResponse = page.waitForResponse(
      (response) => response.url().includes('/api/users.php') && response.request().method() === 'POST'
    );
    await page.locator('#resetUserPasswordForm button[type="submit"]').click();
    expect((await resetResponse).ok()).toBeTruthy();

    await logout(page);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expectLoginFailure(page, lifecycleUsername, lifecyclePassword + '-invalid');
    }

    await login(page, adminUsername, adminPassword, true);
    await page.locator('.tab[data-tab="admin"]').click();
    const lockedRow = page.locator('#usersTable tbody tr').filter({ hasText: lifecycleUsername }).first();

    const unlockResponse = page.waitForResponse(
      (response) => response.url().includes('/api/users.php') && response.request().method() === 'POST'
    );
    await lockedRow.locator('[data-unlock-user]').click();
    expect((await unlockResponse).ok()).toBeTruthy();

    await logout(page);
    await login(page, lifecycleUsername, lifecycleResetPassword);
    await logout(page);

    await login(page, adminUsername, adminPassword);
    await page.locator('.tab[data-tab="admin"]').click();
    const activeRow = page.locator('#usersTable tbody tr').filter({ hasText: lifecycleUsername }).first();

    const deactivateResponse = page.waitForResponse(
      (response) => response.url().includes('/api/users.php') && response.request().method() === 'POST'
    );
    await activeRow.locator('[data-toggle-user]').click();
    expect((await deactivateResponse).ok()).toBeTruthy();

    await logout(page);
    await expectLoginFailure(page, lifecycleUsername, lifecycleResetPassword);
  });

  test('logout invalidates the protected browser session', async ({ page }) => {
    await login(page, adminUsername, adminPassword);
    await logout(page);
    await page.goto('index.php');
    await expect(page).toHaveURL(/login\.php$/);
  });
});
