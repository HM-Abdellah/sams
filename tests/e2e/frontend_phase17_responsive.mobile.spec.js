import { test, expect } from '@playwright/test'

const students = [
  {
    id: 301,
    student_number: 'E2E-301',
    massar_code: 'E2E-MASSAR-301',
    birth_date: '2009-01-10',
    first_name: 'Demo',
    last_name: 'Student',
    status: 'active',
    created_at: '2026-09-29T08:00:00Z',
    updated_at: '2026-09-29T08:00:00Z',
  },
]

const schoolClass = {
  id: 1,
  name: 'E2E-RESPONSIVE-A',
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
  students: students.map(({ id, first_name, last_name }) => ({ id, first_name, last_name })),
  attendance: [],
  period_signoffs: [],
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
          user: { id: 10, school_id: 20, employee_id: 'teacher.e2e', full_name: 'A very long E2E Teacher display name for responsive testing', role: 'teacher', account_status: 'active' },
          csrf: 'e2e-csrf',
        },
      }),
    })
  })

  await page.route('**/api/classes.php', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { classes: [schoolClass] } }),
    })
  })

  await page.route('**/api/students.php*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { students } }),
    })
  })

  await page.route('**/api/v1/classes/1/attendance?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: attendanceData }),
    })
  })
}

async function assertNoPageOverflow(page) {
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }))
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport)
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewport)
}

test.describe('frontend Phase 17 responsive engineering', () => {
  test('teacher shell stays within the viewport and uses persistent desktop navigation plus a mobile drawer', async ({ page }) => {
    await installTeacherFixture(page)
    await page.goto('/app/teacher')
    await expect(page.getByRole('heading', { name: 'Teacher workspace' })).toBeVisible()

    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 })
      await assertNoPageOverflow(page)
      await expect(page.getByRole('banner')).toBeVisible()
      await expect(page.getByRole('banner').locator('.grid.size-10')).toBeVisible()
    }

    await page.setViewportSize({ width: 320, height: 800 })
    const menuTrigger = page.getByRole('button', { name: 'Open navigation' })
    await expect(menuTrigger).toBeVisible()

    await menuTrigger.click()
    const drawer = page.getByRole('dialog', { name: 'SAMS' })
    await expect(drawer).toBeVisible()
    const nav = drawer.getByRole('navigation', { name: 'Application' })
    await expect(nav).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Classes' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Attendance' })).toBeVisible()
    await assertNoPageOverflow(page)

    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(menuTrigger).toBeFocused()

    await menuTrigger.click()
    await expect(drawer).toBeVisible()
    await drawer.getByRole('navigation', { name: 'Application' }).getByRole('link', { name: 'Classes' }).click()
    await expect(drawer).toBeHidden()
    await expect(page).toHaveURL(new RegExp('/app/classes$'))

    await page.setViewportSize({ width: 1280, height: 800 })
    const desktopNav = page.locator('aside nav[aria-label="Application"]')
    await expect(desktopNav).toBeVisible()
    const classesLink = desktopNav.getByRole('link', { name: 'Classes' })
    await expect(classesLink).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('banner')).toContainText('Classes')
    await assertNoPageOverflow(page)
  })

  test('attendance register stays inside the viewport and exposes all periods on narrow phones', async ({ page }) => {
    await installTeacherFixture(page)
    await page.goto('/app/attendance?class_id=1&week_start=2026-09-21')
    await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible()
    await page.setViewportSize({ width: 320, height: 640 })
    await expect(page.locator('table tbody tr').filter({ hasText: 'Demo Student' })).toBeVisible()
    await assertNoPageOverflow(page)

    const periodHeaders = page.getByRole('columnheader', { name: /Period [1-8]/ })
    await expect(periodHeaders).toHaveCount(8)
    const statusCells = page.locator('button.sams-touch-cell')
    await expect(statusCells.first()).toBeVisible()
    const target = await statusCells.first().boundingBox()
    expect(target).not.toBeNull()
    expect(target.width).toBeGreaterThanOrEqual(48)
    expect(target.height).toBeGreaterThanOrEqual(48)
    await expect(page.getByText('Swipe horizontally to reach the afternoon periods.')).toBeVisible()
  })

  test('student form dialog remains contained and scrollable on a short phone', async ({ page }) => {
    await installTeacherFixture(page)
    await page.goto('/app/students?class_id=1')
    await expect(page.getByText('Demo Student')).toBeVisible()
    await page.setViewportSize({ width: 320, height: 500 })
    await page.getByRole('button', { name: 'Add student' }).click()

    const dialog = page.getByRole('dialog', { name: 'Add student' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(320)
    expect(box.y + box.height).toBeLessThanOrEqual(500)

    const scrollMetrics = await dialog.evaluate((element) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }))
    expect(scrollMetrics.scrollHeight).toBeGreaterThanOrEqual(scrollMetrics.clientHeight)
    await expect(page.getByLabel('Birth date')).toBeVisible()
    await assertNoPageOverflow(page)
  })

  test('admin class management keeps forms and wide tables inside the mobile viewport', async ({ page }) => {
    await page.route('**/api/v1/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            authenticated: true,
            user: { id: 10, school_id: 20, employee_id: 'admin.e2e', full_name: 'E2E Admin', role: 'admin', account_status: 'active' },
            csrf: 'e2e-csrf',
          },
        }),
      })
    })
    await page.route('**/api/v1/admin/classes', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            classes: [
              { id: 1, name: 'E2E-RESPONSIVE-CLASS-WITH-A-LONG-NAME', level: '2BAC', branch: 'SP', academic_year_id: 1, is_active: 1, academic_year_name: '2026/2027', academic_year_active: 1 },
            ],
          },
        }),
      })
    })
    await page.goto('/app/admin/classes')
    await expect(page.getByRole('heading', { name: 'Classes' })).toBeVisible()
    await page.setViewportSize({ width: 320, height: 640 })
    await assertNoPageOverflow(page)

    const formGrid = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Create class' }) }).locator('.grid')
    await expect(formGrid).toBeVisible()
    expect(await formGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1)

    const tableScroller = page.locator('.sams-scroll-x').last()
    await expect(tableScroller).toBeVisible()
    const scrollerBox = await tableScroller.boundingBox()
    expect(scrollerBox).not.toBeNull()
    expect(scrollerBox.width).toBeLessThanOrEqual(320)
    await expect(page.getByText('E2E-RESPONSIVE-CLASS-WITH-A-LONG-NAME')).toBeVisible()
  })
})