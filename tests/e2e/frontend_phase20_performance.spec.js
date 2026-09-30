import { test, expect } from '@playwright/test'

const enforcePerformanceBudget = process.env.SAMS_PERFORMANCE_MODE === '1'

async function installSessionFixture(page, role) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let data

    if (path.endsWith('/auth/session')) {
      data = {
        success: true,
        data: {
          authenticated: true,
          user: {
            id: role === 'admin' ? 1 : 10,
            school_id: 20,
            employee_id: role,
            full_name: `E2E Performance ${role}`,
            role,
            account_status: 'active',
          },
          csrf: 'e2e-csrf',
        },
      }
    } else if (path.endsWith('/api/classes.php')) {
      data = {
        success: true,
        data: {
          classes: [
            {
              id: 1,
              name: 'E2E-PERFORMANCE-A',
              level: '2BAC',
              branch: 'SP',
              academic_year_id: 1,
              academic_year_name: '2026/2027',
            },
          ],
        },
      }
    } else {
      data = { success: true, data: {} }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    })
  })
}

async function installAnonymousFixture(page) {
  await page.route('**/api/v1/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { authenticated: false } }),
    })
  })
}

async function scriptMetrics(page) {
  return page.evaluate(() => {
    const scripts = performance.getEntriesByType('resource')
      .filter((entry) => entry.initiatorType === 'script')
      .map((entry) => ({
        file: entry.name.split('/').pop() ?? entry.name,
        encoded: entry.encodedBodySize,
      }))

    return {
      scripts,
      encodedJsBytes: scripts.reduce((sum, entry) => sum + entry.encoded, 0),
    }
  })
}

test.describe('frontend Phase 20 performance', () => {
  test('teacher first route stays within JS budget and lazy-loads attendance', async ({ page }) => {
    await installSessionFixture(page, 'teacher')
    await page.goto('/app/teacher', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Teacher workspace' })).toBeVisible()

    const initial = await scriptMetrics(page)
    if (enforcePerformanceBudget) expect(initial.encodedJsBytes).toBeLessThanOrEqual(110_000)
    expect(initial.scripts.some(({ file }) => file.startsWith('TeacherDashboardPage-'))).toBeTruthy()
    expect(initial.scripts.some(({ file }) => file.startsWith('Admin'))).toBeFalsy()

    await page.getByRole('link', { name: 'Attendance', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/attendance/)
    // Lazy route chunks can cold-start slower on CI runners; wait on the semantic page-ready signal rather than a fixed delay.
    await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible({ timeout: 15_000 })

    const afterNavigation = await scriptMetrics(page)
    expect(afterNavigation.scripts.some(({ file }) => file.startsWith('TeacherAttendancePage-'))).toBeTruthy()
  })

  test('admin first route stays within JS budget and does not eagerly load teacher pages', async ({ page }) => {
    await installSessionFixture(page, 'admin')
    await page.goto('/app/admin/users', { waitUntil: 'networkidle' })

    const metrics = await scriptMetrics(page)
    if (enforcePerformanceBudget) expect(metrics.encodedJsBytes).toBeLessThanOrEqual(110_000)
    expect(metrics.scripts.some(({ file }) => file.startsWith('AdminUsersPage-'))).toBeTruthy()
    expect(metrics.scripts.some(({ file }) => file.startsWith('Teacher'))).toBeFalsy()
  })

  test('login first route stays within JS budget and does not eagerly load application pages', async ({ page }) => {
    await installAnonymousFixture(page)
    await page.goto('/login', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

    const metrics = await scriptMetrics(page)
    if (enforcePerformanceBudget) expect(metrics.encodedJsBytes).toBeLessThanOrEqual(110_000)
    expect(metrics.scripts.some(({ file }) => file.startsWith('Teacher'))).toBeFalsy()
    expect(metrics.scripts.some(({ file }) => file.startsWith('Admin'))).toBeFalsy()
  })
})
