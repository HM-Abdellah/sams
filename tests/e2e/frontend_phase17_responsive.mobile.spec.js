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
  test('teacher shell stays within the viewport at phone, tablet, and desktop widths', async ({ page }) => {
    await installTeacherFixture(page)
    await page.goto('/app/teacher')
    await expect(page.getByRole('heading', { name: 'Teacher workspace' })).toBeVisible()

    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 })
      await assertNoPageOverflow(page)
      const profileName = page.locator('header p.truncate')
      await expect(profileName).toBeVisible()
    }

    await page.setViewportSize({ width: 320, height: 800 })
    const nav = page.getByRole('navigation', { name: 'Application' })
    await expect(nav).toBeVisible()
    expect(await nav.evaluate((element) => element.scrollWidth)).toBeGreaterThan(await nav.evaluate((element) => element.clientWidth))
    const lastLink = nav.getByRole('link').last()
    await lastLink.evaluate((element) => element.scrollIntoView({ inline: 'end', block: 'nearest' }))
    await expect(lastLink).toBeInViewport()
  })

  test('attendance controls reflow on narrow phones without page overflow', async ({ page }) => {
    await installTeacherFixture(page)
    await page.goto('/app/attendance?class_id=1&week_start=2026-09-21')
    await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible()
    await page.setViewportSize({ width: 320, height: 640 })
    await expect(page.locator('article').filter({ hasText: 'Demo Student' })).toBeVisible()
    await assertNoPageOverflow(page)

    const periodGrid = page.locator('div.grid.grid-cols-2')
    await expect(periodGrid).toBeVisible()
    const buttons = periodGrid.getByRole('button')
    await expect(buttons).toHaveCount(8)
    const widths = await buttons.evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().width)))
    expect(Math.max(...widths)).toBeLessThanOrEqual(150)
    expect(Math.min(...widths)).toBeGreaterThan(0)
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

    const tableScroller = page.locator('.overflow-x-auto').last()
    await expect(tableScroller).toBeVisible()
    const scrollerBox = await tableScroller.boundingBox()
    expect(scrollerBox).not.toBeNull()
    expect(scrollerBox.width).toBeLessThanOrEqual(320)
    await expect(page.getByText('E2E-RESPONSIVE-CLASS-WITH-A-LONG-NAME')).toBeVisible()
  })
})
