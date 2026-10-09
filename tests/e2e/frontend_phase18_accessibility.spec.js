import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const student = {
  id: 301,
  student_number: 'E2E-301',
  massar_code: 'E2E-MASSAR-301',
  birth_date: '2009-01-10',
  first_name: 'Demo',
  last_name: 'Student',
  status: 'active',
  created_at: '2026-09-29T08:00:00Z',
  updated_at: '2026-09-29T08:00:00Z',
}

const schoolClass = {
  id: 1,
  name: 'E2E-ACCESSIBILITY-A',
  level: '2BAC',
  branch: 'SP',
  academic_year_id: 1,
  academic_year_name: '2026/2027',
  academic_year_starts_on: '2026-09-01',
  academic_year_ends_on: '2027-07-31',
}

const attendanceData = {
  class_id: 1,
  week_start: '2026-09-21',
  week_end: '2026-09-26',
  students: [student],
  attendance: [],
  attendance_revisions: [],
  period_signoffs: [],
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

async function installTeacherFixture(page) {
  await page.route('**/api/v1/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          authenticated: true,
          user: { id: 10, school_id: 20, employee_id: 'teacher.e2e', full_name: 'E2E Accessibility Teacher', role: 'teacher', account_status: 'active' },
          csrf: 'e2e-csrf',
        },
      }),
    })
  })
  await page.route('**/api/classes.php', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { classes: [schoolClass] } }) })
  })

  await page.route('**/api/students.php*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { students: [student] } }) })
  })

  await page.route('**/api/v1/classes/1/attendance?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: attendanceData }) })
  })
}

function controlNameIssues(elements) {
  return elements.filter((element) => {
    const labelledBy = element.getAttribute('aria-labelledby')
    const hasAriaLabel = Boolean(element.getAttribute('aria-label')?.trim())
    const hasLabel = Boolean(element.labels && element.labels.length > 0)
    const hasTitle = Boolean(element.getAttribute('title')?.trim())
    const hasNativeName = element.tagName === 'BUTTON' && Boolean(element.textContent?.trim())
    return !hasAriaLabel && !labelledBy && !hasLabel && !hasTitle && !hasNativeName
  })
}
test.describe('frontend Phase 18 accessibility', () => {
  test('teacher shell exposes an active page and named controls', async ({ page }) => {
    await installTeacherFixture(page)
    await page.goto('/app/teacher')
    await expect(page.getByRole('heading', { name: 'Teacher workspace' })).toBeVisible()

    await expect(page.locator('nav[aria-label="Application"] a[aria-current="page"]')).toHaveCount(1)

    const issues = await page.locator('button, input, select, textarea').evaluateAll(controlNameIssues)
    expect(issues).toEqual([])

    await page.keyboard.press('Tab')
    const focused = page.locator(':focus-visible')
    await expect(focused).toBeVisible()
    expect(await focused.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid')

    await page.locator('#sams-language').selectOption('ar')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    expect(await page.locator('button, input, select, textarea').evaluateAll(controlNameIssues)).toEqual([])
  })

  test('student dialog traps focus, supports Escape, and restores trigger focus', async ({ page }) => {
    await installTeacherFixture(page)
    await page.goto('/app/students?class_id=1')
    const trigger = page.getByRole('button', { name: 'Add student' })
    await trigger.click()

    const dialog = page.getByRole('dialog', { name: 'Add student' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Cancel' }).first()).toBeFocused()

    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press('Tab')
      await expect(dialog).toContainText('Add student')
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBeTruthy()
    }

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('attendance selection semantics expose the active day and filter state', async ({ page }) => {
    await installTeacherFixture(page)
    await page.goto('/app/attendance?class_id=1&week_start=2026-09-21')
    await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible()

    const dayGroup = page.getByRole('group', { name: 'Attendance register' })
    await expect(dayGroup).toBeVisible()
    await expect(dayGroup.locator('button[aria-pressed="true"]')).toHaveCount(1)

    const markGroup = page.getByRole('group', { name: 'Mark as' })
    await expect(markGroup).toHaveCount(1)
    await expect(markGroup.locator('button[aria-pressed="true"]')).toHaveCount(1)

    const filterGroup = page.getByRole('group', { name: 'Status' })
    await expect(filterGroup).toHaveCount(1)
    await expect(filterGroup.locator('button[aria-pressed="true"]')).toHaveCount(1)

    const controls = await page.locator('button, input, select, textarea').evaluateAll(controlNameIssues)
    expect(controls).toEqual([])
  })

  test('automated accessibility scan passes on teacher workspace', async ({ page }) => {
    await installTeacherFixture(page)
    await page.goto('/app/teacher')
    await expect(page.getByRole('heading', { name: 'Teacher workspace' })).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })

  test('automated accessibility scan passes on attendance', async ({ page }) => {
    await installTeacherFixture(page)
    await page.goto('/app/attendance?class_id=1&week_start=2026-09-21')
    await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])

    await page.setViewportSize({ width: 320, height: 640 })
    const touchTargetIssues = await page.locator('button:visible').evaluateAll((elements) => elements.flatMap((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width >= 24 && rect.height >= 24 ? [] : [element.outerHTML]
    }))
    expect(touchTargetIssues).toEqual([])

    const mobileResults = await new AxeBuilder({ page }).analyze()
    expect(mobileResults.violations).toEqual([])

    await page.setViewportSize({ width: 1024, height: 800 })
    const table = page.getByRole('table')
    await expect(table).toBeVisible()
    await expect(table.getByRole('columnheader', { name: /Period [1-8]/ })).toHaveCount(8)
  })

  test('login page passes accessibility scan and names its authentication controls', async ({ page }) => {
    await installAnonymousFixture(page)
    // Avoid measuring contrast while the entrance animation is mid-fade.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

    const controls = await page.locator('button, input, select, textarea').evaluateAll(controlNameIssues)
    expect(controls).toEqual([])
    expect(await page.getByLabel('SAMS code').count()).toBe(1)
    expect(await page.getByLabel('Password', { exact: true }).count()).toBe(1)

    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })

  test('reduced motion is respected by shared controls', async ({ page }) => {
    await installTeacherFixture(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/app/teacher')
    const signOut = page.getByRole('button', { name: 'Sign out' })
    await expect(signOut).toBeVisible()
    const transitionSeconds = await signOut.evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration))
    expect(transitionSeconds).toBeLessThanOrEqual(0.00001)
  })
})
