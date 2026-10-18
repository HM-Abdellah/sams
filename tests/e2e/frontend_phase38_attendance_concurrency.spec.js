import { test, expect } from '@playwright/test'

const student = { id: 801, first_name: 'Phase38', last_name: 'Student' }

test.describe('frontend Phase 38 shared attendance concurrency', () => {
  test('surfaces a server conflict and lets the teacher explicitly keep local changes', async ({ page }) => {
    const requests = []
    let getCount = 0
    let revision = 5
    let status = null
    let conflictOnce = true

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
              employee_id: 'phase38.teacher',
              full_name: 'Phase 38 Teacher',
              role: 'teacher',
              account_status: 'active',
            },
            csrf: 'phase38-csrf',
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
          data: {
            classes: [{
              id: 1,
              name: 'E2E-PHASE38',
              level: '2BAC',
              branch: 'SP',
              academic_year_id: 1,
            }],
          },
        }),
      })
    })

    await page.route('**/api/v1/classes/1/attendance?*', async (route) => {
      getCount += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            class_id: 1,
            week_start: '2026-09-21',
            week_end: '2026-09-26',
            students: [student],
            attendance: status === null ? [] : [{
              id: 901,
              enrollment_id: 801,
              student_id: 801,
              attendance_date: '2026-09-21',
              period: 1,
              status,
            }],
            attendance_revisions: [{
              attendance_date: '2026-09-21',
              period: 1,
              revision,
            }],
            period_signoffs: [],
          },
        }),
      })
    })

    await page.route('**/api/v1/classes/1/signature', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { signature: null } }),
      })
    })

    await page.route('**/api/v1/classes/1/attendance/bulk', async (route) => {
      const payload = route.request().postDataJSON()
      requests.push(payload)

      if (conflictOnce) {
        conflictOnce = false
        revision = 6
        status = 'late'
        await route.fulfill({
          status: 409,
          headers: { 'X-SAMS-Error-Code': 'ATTENDANCE_CONCURRENCY_CONFLICT' },
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Attendance for this lesson was updated by another teacher.',
          }),
        })
        return
      }

      expect(payload.entries).toEqual([
        expect.objectContaining({
          student_id: 801,
          attendance_date: '2026-09-21',
          period: 1,
          action: 'upsert',
          status: 'absent',
          expected_revision: 6,
        }),
      ])

      status = 'absent'
      revision = 7
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            changed: 1,
            unchanged: 0,
            total: 1,
            revisions: [{
              attendance_date: '2026-09-21',
              period: 1,
              revision: 7,
            }],
          },
        }),
      })
    })

    await page.goto('/app/attendance?class_id=1&week_start=2026-09-21')
    await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible()

    await page.getByRole('group', { name: 'Mark as' }).getByRole('button', { name: 'Absent' }).click()
    await page.locator('[data-attendance-row]:visible').first().locator('button[data-attendance-period="1"]').click()

    await expect.poll(() => requests.length).toBe(1)
    await expect(page.getByText('The register was updated by another teacher.')).toBeVisible()
    await expect(page.getByText('Keep my changes')).toBeVisible()
    await expect(page.locator('[data-attendance-row]:visible').first().locator('button[data-attendance-period="1"]')).toHaveAttribute('aria-label', /Period 1 — Late/)

    await page.getByRole('button', { name: 'Keep my changes' }).click()

    await expect.poll(() => requests.length).toBe(2)
    await expect(page.getByText('Saved and confirmed by the server.')).toBeVisible()
    await expect.poll(() => getCount).toBe(3)
    await expect(page.locator('[data-attendance-row]:visible').first().locator('button[data-attendance-period="1"]')).toHaveAttribute('aria-label', /Period 1 — Absent/)
  })
})
