import { test, expect } from '@playwright/test'

const student = { id: 501, first_name: 'Phase37', last_name: 'Student' }
const attendanceData = {
  class_id: 1,
  week_start: '2026-09-21',
  week_end: '2026-09-26',
  students: [student],
  attendance: [],
  period_signoffs: [],
}

async function installFixture(page, requests) {
  const serverRecords = new Map()

  await page.route('**/api/v1/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { authenticated: true, user: { id: 10, school_id: 20, employee_id: 'phase37.teacher', full_name: 'Phase 37 Teacher', role: 'teacher', account_status: 'active' }, csrf: 'phase37-csrf' } }),
    })
  })

  await page.route('**/api/classes.php', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { classes: [{ id: 1, name: 'E2E-PHASE37', level: '2BAC', branch: 'SP', academic_year_id: 1 }] } }),
    })
  })

  await page.route('**/api/v1/classes/1/attendance?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { ...attendanceData, attendance: Array.from(serverRecords.values()) } }),
    })
  })

  await page.route('**/api/v1/classes/1/signature', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { signature: { id: 1, signature_data: 'data:image/png;base64,phase37', mime_type: 'image/png', updated_at: '2026-09-20T10:00:00Z' } } }),
    })
  })

  await page.route('**/api/v1/classes/1/attendance/bulk', async (route) => {
    const payload = route.request().postDataJSON()
    requests.push(payload)
    for (const entry of payload.entries) {
      const key = entry.student_id + '|' + entry.attendance_date + '|' + entry.period
      if (entry.action === 'delete') {
        serverRecords.delete(key)
      } else {
        serverRecords.set(key, {
          id: 900 + serverRecords.size + 1,
          enrollment_id: 700 + entry.student_id,
          student_id: entry.student_id,
          attendance_date: entry.attendance_date,
          period: entry.period,
          status: entry.status,
        })
      }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { changed: payload.entries.length, unchanged: 0, total: payload.entries.length } }),
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

test.describe('frontend Phase 37 teacher attendance responsive reconstruction', () => {
  test('mobile register switches periods without exposing the desktop grid', async ({ page }) => {
    const requests = []
    await installFixture(page, requests)
    await page.goto('/app/attendance?class_id=1&week_start=2026-09-21')
    await page.setViewportSize({ width: 320, height: 640 })

    const periodSelector = page.getByRole('group', { name: 'Period' })
    await expect(periodSelector.getByRole('button')).toHaveCount(8)
    await periodSelector.getByRole('button', { name: /Period 8/ }).click()
    await expect(periodSelector.getByRole('button', { name: /Period 8/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('table')).toBeHidden()
    await expect(page.locator('[data-attendance-row]:visible')).toHaveCount(1)
    await expect(page.locator('button.sams-touch-cell:visible').first()).toHaveAttribute('data-attendance-period', '8')
    await assertNoPageOverflow(page)
  })

  test('mobile marking sends the selected period and keeps the save flow server-confirmed', async ({ page }) => {
    const requests = []
    await installFixture(page, requests)
    await page.goto('/app/attendance?class_id=1&week_start=2026-09-21')
    await page.setViewportSize({ width: 390, height: 844 })

    const periodSelector = page.getByRole('group', { name: 'Period' })
    await periodSelector.getByRole('button', { name: /Period 8/ }).click()
    await page.getByRole('group', { name: 'Mark as' }).getByRole('button', { name: 'Absent' }).click()
    const statusButton = page.locator('[data-attendance-row]:visible').first().locator('button[data-attendance-period="8"]')
    await statusButton.click()

    await expect.poll(() => requests.length).toBe(1)
    expect(requests[0].entries).toEqual([
      expect.objectContaining({ student_id: 501, attendance_date: '2026-09-21', period: 8, action: 'upsert', status: 'absent' }),
    ])
    await expect(statusButton).toHaveAttribute('aria-label', /Period 8 — Absent/)
    await expect(page.getByText('Saved and confirmed by the server.')).toBeVisible()
    await assertNoPageOverflow(page)
  })
})
