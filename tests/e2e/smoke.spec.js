import { test, expect } from '@playwright/test';

test('login page renders', async ({ page }) => {
  await page.goto('/login.php');
  await expect(page).toHaveTitle(/SAMS/i);
  await expect(page.locator('#loginForm')).toBeVisible();
  await expect(page.locator('#username')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
});

test('protected dashboard redirects unauthenticated users to login', async ({ page }) => {
  await page.goto('/index.php');
  await expect(page).toHaveURL(/login\.php$/);
});
