import { test, expect } from '@playwright/test'

const teacherUser = {
  id: 10,
  school_id: 20,
  employee_id: 'teacher.e2e',
  full_name: 'E2E Security Teacher',
  role: 'teacher',
  account_status: 'active',
}

const schoolClass = {
  id: 1,
  name: 'E2E-SECURITY-A',
  level: '2BAC',
  branch: 'SP',
  academic_year_id: 1,
  academic_year_name: '2026/2027',
}

async function installTeacherSession(page, classes = [schoolClass]) {
  await page.route('**/api/v1/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { authenticated: true, user: teacherUser, csrf: 'e2e-csrf' },
      }),
    })
  })

  await page.route('**/api/classes.php', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { classes } }),
    })
  })
}
test.describe('frontend Phase 19 security', () => {
  test('accepts only same-origin internal return paths', async ({ page }) => {
    await page.goto('/login')
    const cases = await page.evaluate(async () => {
      const { safeReturnTo } = await import('/src/routes/safeReturnTo.ts')
      return {
        internal: safeReturnTo('/app/teacher?class_id=1#attendance'),
        protocolRelative: safeReturnTo('//evil.example/phishing'),
        javascript: safeReturnTo('javascript:alert(1)'),
        absoluteExternal: safeReturnTo('https://evil.example/phishing'),
        backslash: safeReturnTo('\\\\evil.example\\phishing'),
      }
    })

    expect(cases.internal).toBe('/app/teacher?class_id=1#attendance')
    expect(cases.protocolRelative).toBe('/app')
    expect(cases.javascript).toBe('/app')
    expect(cases.absoluteExternal).toBe('/app')
    expect(cases.backslash).toBe('/app')
  })

  test('renders attacker-controlled display text as text, never executable markup', async ({ page }) => {
    const maliciousName = '<img src=x onerror="window.__xss=1">SECURITY-XSS'
    await installTeacherSession(page, [{
      ...schoolClass,
      name: maliciousName,
    }])

    await page.goto('/app/teacher')
    await expect(page.getByRole('heading', { name: maliciousName })).toBeVisible()
    await expect(page.locator('img[src="x"]')).toHaveCount(0)
    expect(await page.evaluate(() => window.__xss ?? 0)).toBe(0)
  })
  test('protected API mutations send the captured CSRF token', async ({ page }) => {
    let csrfHeader = null
    await page.route('**/api/v1/security-test', async (route) => {
      csrfHeader = route.request().headers()['x-csrf-token'] ?? null
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { ok: true } }),
      })
    })

    await page.goto('/login')
    await page.evaluate(async () => {
      const { apiClient } = await import('/src/services/api/client.ts')
      apiClient.setCsrfToken('e2e-csrf')
      await apiClient.request('/security-test', { method: 'POST', body: { ok: true } })
    })

    expect(csrfHeader).toBe('e2e-csrf')
  })

  test('public onboarding requests intentionally omit CSRF', async ({ page }) => {
    let csrfHeader = 'sentinel'
    await page.route('**/api/v1/onboarding/request', async (route) => {
      csrfHeader = route.request().headers()['x-csrf-token'] ?? ''
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { request_id: 1, request_token: 'safe-token', status: 'pending', expires_at: '2026-10-01T00:00:00Z' },
        }),
      })
    })

    await page.goto('/login')
    await page.evaluate(async () => {
      const { onboardingApi } = await import('/src/features/onboarding/api.ts')
      await onboardingApi.request({
        onboarding_code: 'PUBLIC-CODE',
        full_name: 'Security Test',
      })
    })

    expect(csrfHeader).toBe('')
  })
  test('teacher cannot cross the admin route boundary', async ({ page }) => {
    await installTeacherSession(page)
    await page.goto('/app/admin/users')
    await expect(page.getByRole('heading', { name: 'Unauthorized' })).toBeVisible()
    await expect(page).toHaveURL(/\/unauthorized$/)
  })

  test('session credentials are not persisted to web storage', async ({ page }) => {
    await installTeacherSession(page)
    await page.goto('/app/teacher')

    const storage = await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
      cookies: document.cookie,
    }))

    expect(storage.local).toEqual({})
    expect(storage.session).toEqual({})
    expect(storage.cookies).not.toContain('csrf')
  })
})
