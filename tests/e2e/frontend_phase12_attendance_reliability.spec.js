import { test, expect } from '@playwright/test'

const students = [
  { id: 1, first_name: 'Jean', last_name: 'Dupont' },
  { id: 2, first_name: 'Marie', last_name: 'Martin' },
  { id: 3, first_name: 'Youssef', last_name: 'Alaoui' },
]

function makeRecord(id, studentId, date, period, status) {
  return { id, student_id: studentId, enrollment_id: 100 + studentId, attendance_date: date, period, status }
}

test.describe('frontend Phase 12 attendance reliability', () => {
  let serverRecords
  let bulkRequests
  let failNextBulk
  let bulkDelayMs
  let concurrentServerStatus

  test.beforeEach(async ({ page }) => {
    serverRecords = new Map([
      ['1|2026-09-21|1', makeRecord(1, 1, '2026-09-21', 1, 'absent')],
      ['2|2026-09-21|1', makeRecord(2, 2, '2026-09-21', 1, 'absent')],
      ['3|2026-09-22|2', makeRecord(3, 3, '2026-09-22', 2, 'late')],
    ])
    bulkRequests = []
    failNextBulk = false
    bulkDelayMs = 0
    concurrentServerStatus = null

    await page.route('**/api/v1/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            authenticated: true,
            user: {
              id: 10,
              school_id: 20,
              employee_id: 'teacher.e2e',
              full_name: 'E2E Teacher',
              role: 'teacher',
              account_status: 'active',
            },
            csrf: 'e2e-csrf-token',
          },
        }),
      })
    })

    await page.route('**/api/classes.php', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { classes: [{ id: 1, name: 'E2E-2BAC-A', level: '2BAC', branch: 'SP', academic_year_id: 1 }] },
        }),
      })
    })

    await page.route('**/api/v1/classes/1/attendance?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            class_id: 1,
            week_start: '2026-09-21',
            week_end: '2026-09-26',
            students,
            attendance: Array.from(serverRecords.values()),
            period_signoffs: [{
              id: 50,
              class_id: 1,
              teacher_id: 10,
              teacher_name: 'E2E Teacher',
              employee_id: 'teacher.e2e',
              attendance_date: '2026-09-25',
              period: 8,
              status: 'signed',
              signed_at: '2026-09-25T17:00:00Z',
              invalidated_at: null,
            }],
          },
        }),
      })
    })

    await page.route('**/api/v1/classes/1/attendance/bulk', async (route) => {
      const payload = route.request().postDataJSON()
      bulkRequests.push(payload)
      if (bulkDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, bulkDelayMs))
      if (failNextBulk) {
        failNextBulk = false
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Injected test failure.' } }),
        })
        return
      }
      for (const entry of payload.entries) {
        const key = entry.student_id + '|' + entry.attendance_date + '|' + entry.period
        if (entry.action === 'delete') {
          serverRecords.delete(key)
        } else {
          serverRecords.set(key, makeRecord(
            100 + serverRecords.size + 1,
            entry.student_id,
            entry.attendance_date,
            entry.period,
            entry.status,
          ))
          if (concurrentServerStatus && entry.student_id === 1 && entry.attendance_date === '2026-09-21' && entry.period === 1) {
            serverRecords.set(key, makeRecord(999, entry.student_id, entry.attendance_date, entry.period, concurrentServerStatus))
          }
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { changed: payload.entries.length, unchanged: 0, total: payload.entries.length } }),
      })
    })

    await page.goto('/app/attendance?class_id=1&week_start=2026-09-21')
    await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible()
  })
  test('desktop and mobile workflows adapt without changing the attendance domain', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('article').filter({ hasText: 'Jean Dupont' })).toBeVisible()
    await expect(page.locator('table')).toBeHidden()

    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('article').filter({ hasText: 'Jean Dupont' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Previous week' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next week' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Period 8' })).toBeVisible()
  })

  test('status changes are optimistically visible and batched through the typed bulk API', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const statusSelects = page.locator('article select')
    await expect(statusSelects).toHaveCount(3)

    await statusSelects.nth(0).selectOption('present')
    await statusSelects.nth(1).selectOption('late')
    await statusSelects.nth(2).selectOption('excused')

    await expect.poll(() => bulkRequests.length).toBe(1)
    expect(bulkRequests[0].entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ student_id: 1, attendance_date: '2026-09-21', period: 1, action: 'upsert', status: 'present' }),
      expect.objectContaining({ student_id: 2, attendance_date: '2026-09-21', period: 1, action: 'upsert', status: 'late' }),
      expect.objectContaining({ student_id: 3, attendance_date: '2026-09-21', period: 1, action: 'upsert', status: 'excused' }),
    ]))

    await expect(statusSelects.nth(1)).toHaveValue('late')
    await statusSelects.nth(0).selectOption('clear')
    await expect.poll(() => bulkRequests.length).toBe(2)
    expect(bulkRequests[1].entries).toEqual([
      expect.objectContaining({ student_id: 1, action: 'delete', attendance_date: '2026-09-21', period: 1 }),
    ])
    await expect(statusSelects.nth(0)).toHaveValue('clear')
    await expect(page.getByText('Saved and confirmed by the server.')).toBeVisible()
  })

  test('failed bulk save preserves the pending draft and supports retry', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const firstStatus = page.locator('article select').first()
    await expect(firstStatus).toHaveValue('absent')

    failNextBulk = true
    await firstStatus.selectOption('present')

    await expect.poll(() => bulkRequests.length).toBe(1)
    await expect(page.getByText('The changes were not saved. They remain pending and can be retried.')).toBeVisible()
    await expect(firstStatus).toHaveValue('present')
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()

    await page.getByRole('button', { name: 'Retry' }).click()
    await expect.poll(() => bulkRequests.length).toBe(2)
    await expect(page.getByText('Saved and confirmed by the server.')).toBeVisible()
    await expect(firstStatus).toHaveValue('present')
  })

  test('slow network exposes saving state and duplicate save attempts share one request', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    bulkDelayMs = 1200
    const firstStatus = page.locator('article select').first()

    await firstStatus.selectOption('present')
    await expect(page.getByText(/Saving…/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save now' })).toBeDisabled()

    await expect.poll(() => bulkRequests.length).toBe(1)
    await expect(page.getByRole('button', { name: 'Save now' })).toBeDisabled()
    await expect(page.getByText('Saved and confirmed by the server.')).toBeVisible()
  })

  test('rapid status changes collapse to the latest value for the same cell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const firstStatus = page.locator('article select').first()

    await firstStatus.selectOption('present')
    await firstStatus.selectOption('late')
    await firstStatus.selectOption('excused')

    await expect.poll(() => bulkRequests.length).toBe(1)
    expect(bulkRequests[0].entries).toEqual([
      expect.objectContaining({
        student_id: 1,
        attendance_date: '2026-09-21',
        period: 1,
        action: 'upsert',
        status: 'excused',
      }),
    ])
  })

  test('navigation during save is blocked until the pending write is confirmed', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    bulkDelayMs = 1000
    await page.locator('article select').first().selectOption('present')
    await expect(page.getByText(/Saving…/)).toBeVisible()

    await page.getByRole('link', { name: 'Students' }).click()
    await expect(page).toHaveURL(/\/app\/students/)
    expect(bulkRequests).toHaveLength(1)
  })

  test('reload during save is guarded by before-unload', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    bulkDelayMs = 1000
    await page.locator('article select').first().selectOption('present')
    await expect(page.getByText(/Saving…/)).toBeVisible()

    const prevented = await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    })
    expect(prevented).toBe(true)

    await expect.poll(() => bulkRequests.length).toBe(1)
    await expect(page.getByText('Saved and confirmed by the server.')).toBeVisible()
  })

  test('logout is blocked while attendance work is pending', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    bulkDelayMs = 1000
    await page.locator('article select').first().selectOption('present')
    await expect(page.getByText(/Saving…/)).toBeVisible()

    const logout = page.getByRole('button', { name: 'Sign out' })
    await expect(logout).toBeDisabled()
    await expect(page).toHaveURL(/\/app\/attendance/)
    await expect(page.getByText('Saved and confirmed by the server.')).toBeVisible()
  })

  test('server-authoritative refresh wins over a concurrent change', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    concurrentServerStatus = 'late'

    const firstStatus = page.locator('article select').first()
    await firstStatus.selectOption('present')
    await expect.poll(() => bulkRequests.length).toBe(1)
    await expect(page.getByText('Saved and confirmed by the server.')).toBeVisible()
    await expect(firstStatus).toHaveValue('late')
  })

  test('search and attendance filters operate on the weekly roster', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('article')).toHaveCount(3)

    await page.getByRole('searchbox').fill('Jean')
    await expect(page.locator('article')).toHaveCount(1)
    await expect(page.locator('article')).toContainText('Jean Dupont')

    await page.getByRole('searchbox').fill('')
    await page.getByRole('button', { name: 'With absences' }).click()
    await expect(page.locator('article')).toHaveCount(2)
    await expect(page.locator('article').filter({ hasText: 'Jean Dupont' })).toBeVisible()
    await expect(page.locator('article').filter({ hasText: 'Marie Martin' })).toBeVisible()

    await page.getByRole('button', { name: '8+ absences' }).click()
    await expect(page.locator('article')).toHaveCount(0)
    await expect(page.getByText('No student matches the current filters.')).toBeVisible()
  })

  test('signed lessons are server-protected in the UI', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: /Fri/i }).click()
    await page.getByRole('button', { name: 'Period 8' }).click()

    await expect(page.getByText('Signed lesson')).toBeVisible()
    await expect(page.getByText('Signed by E2E Teacher.')).toBeVisible()
    await expect(page.locator('article select').first()).toBeDisabled()
  })

  test('week and class navigation flush pending changes before changing server context', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const firstStatus = page.locator('article select').first()
    await firstStatus.selectOption('late')
    await page.getByRole('button', { name: 'Next week' }).click()

    await expect.poll(() => bulkRequests.length).toBe(1)
    await expect(page).toHaveURL(/week_start=2026-09-28/)
    expect(bulkRequests[0].entries[0]).toEqual(expect.objectContaining({
      student_id: 1,
      attendance_date: '2026-09-21',
      period: 1,
      status: 'late',
    }))
  })
})
