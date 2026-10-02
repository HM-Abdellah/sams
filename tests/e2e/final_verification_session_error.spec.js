import { test, expect } from '@playwright/test'

async function installSessionFailure(page) {
  await page.route('**/api/v1/auth/session', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Synthetic session failure.' },
      }),
    })
  })
}

test.describe('Final verification session error states', () => {
  test.use({ locale: 'ar-MA' })

  test('protected route keeps the session failure state localized', async ({ page }) => {
    await installSessionFailure(page)
    await page.goto('/app/teacher')

    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { name: 'الجلسة غير متاحة مؤقتًا.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'إعادة التحميل' })).toBeVisible()
  })

  test('public route keeps the session failure state localized', async ({ page }) => {
    await installSessionFailure(page)
    await page.goto('/login')

    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { name: 'الجلسة غير متاحة مؤقتًا.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'إعادة التحميل' })).toBeVisible()
  })
})
