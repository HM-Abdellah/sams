import { test, expect } from '@playwright/test'

const teacherClasses = [
  {
    id: 1,
    name: 'E2E-HISTORY-A',
    level: '2BAC',
    branch: 'SP',
    academic_year_id: 1,
    academic_year_name: '2026/2027',
    academic_year_starts_on: '2026-09-01',
    academic_year_ends_on: '2027-07-31',
  },
]

const adminClasses = [
  {
    id: 1,
    name: 'E2E-HISTORY-A',
    level: '2BAC',
    branch: 'SP',
    academic_year_id: 1,
    academic_year_name: '2026/2027',
    academic_year_active: 0,
    is_active: 0,
  },
  {
    id: 2,
    name: 'E2E-CURRENT-A',
    level: '2BAC',
    branch: 'SVT',
    academic_year_id: 2,
    academic_year_name: '2027/2028',
    academic_year_active: 1,
    is_active: 1,
  },
]

async function installSession(page, role) {
  await page.route('**/api/v1/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          authenticated: true,
          user: {
            id: role === 'admin' ? 10 : 20,
            school_id: 30,
            employee_id: role === 'admin' ? 'admin.e2e' : 'teacher.e2e',
            full_name: role === 'admin' ? 'E2E Admin' : 'E2E Teacher',
            role,
            account_status: 'active',
          },
          csrf: 'e2e-csrf',
        },
      }),
    })
  })
}

test.describe('frontend Phase 15 archive, reports and signatures', () => {
  test('admin archive exposes historical days, month, day, and student history', async ({ page }) => {
    await installSession(page, 'admin')

    await page.route('**/api/v1/admin/classes', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { classes: adminClasses } }),
      })
    })

    await page.route('**/api/v1/admin/archive*', async (route) => {
      const url = new URL(route.request().url())
      const view = url.searchParams.get('view')

      if (view === 'days') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              view: 'days',
              class: { ...adminClasses[0], academic_year_starts_on: '2026-09-01', academic_year_ends_on: '2027-07-31' },
              month: '2027-01',
              start: '2027-01-01',
              end: '2027-01-31',
              days: [{ attendance_date: '2027-01-12', recorded_count: 12, present_count: 10, absent_count: 2, late_count: 0, excused_count: 0, students_with_records: 12, presence_rate: 83.3 }],
            },
          }),
        })
        return
      }

      if (view === 'month') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              view: 'month',
              class: { ...adminClasses[0], academic_year_starts_on: '2026-09-01', academic_year_ends_on: '2027-07-31' },
              month: '2027-01',
              start: '2027-01-01',
              end: '2027-01-31',
              summary: { present_count: 8, absent_count: 2, late_count: 1, excused_count: 0, recorded_count: 11, presence_rate: 72.7 },
              students: [{
                id: 301,
                student_number: 'E2E-301',
                massar_code: 'E2E-MASSAR-301',
                first_name: 'Demo',
                last_name: 'Student',
                birth_date: null,
                enrollment_starts_on: '2026-09-01',
                enrollment_ends_on: '2027-01-20',
                present_count: 8,
                absent_count: 2,
                late_count: 1,
                excused_count: 0,
                recorded_count: 11,
                recorded_days: 10,
                presence_rate: 72.7,
              }],
            },
          }),
        })
        return
      }

      if (view === 'day') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              view: 'day',
              class: { ...adminClasses[0], academic_year_starts_on: '2026-09-01', academic_year_ends_on: '2027-07-31' },
              date: '2027-01-12',
              records: [{
                student_id: 301,
                student_number: 'E2E-301',
                massar_code: 'E2E-MASSAR-301',
                first_name: 'Demo',
                last_name: 'Student',
                birth_date: null,
                enrollment_id: 401,
                enrollment_starts_on: '2026-09-01',
                enrollment_ends_on: '2027-01-20',
                attendance_id: 501,
                attendance_date: '2027-01-12',
                period: 1,
                status: 'absent',
                recorded_by: 20,
                created_at: '2027-01-12T09:00:00Z',
                updated_at: '2027-01-12T09:00:00Z',
              }],
            },
          }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            view: 'student',
            class: { ...adminClasses[0], academic_year_starts_on: '2026-09-01', academic_year_ends_on: '2027-07-31' },
            student_id: 301,
            history: [{
              student_id: 301,
              student_number: 'E2E-301',
              massar_code: 'E2E-MASSAR-301',
              first_name: 'Demo',
              last_name: 'Student',
              birth_date: null,
              enrollment_id: 401,
              class_id: 1,
              class_name: 'E2E-HISTORY-A',
              academic_year_id: 1,
              academic_year_name: '2026/2027',
              starts_on: '2026-09-01',
              ends_on: '2027-01-20',
              attendance_id: 501,
              attendance_date: '2027-01-12',
              period: 1,
              status: 'absent',
              recorded_by: 20,
              created_at: '2027-01-12T09:00:00Z',
              updated_at: '2027-01-12T09:00:00Z',
            }],
          },
        }),
      })
    })

    await page.goto('/app/admin/archive')
    await page.getByRole('combobox', { name: 'Class' }).selectOption('1')
    await expect(page.getByText('E2E-HISTORY-A').last()).toBeVisible()
    await expect(page.getByRole('cell', { name: '12', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: '83.3%', exact: true })).toBeVisible()

    await page.getByRole('combobox', { name: 'View' }).selectOption('month')
    await expect(page.getByRole('cell', { name: 'Demo Student' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '72.7%', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: '2' }).last()).toBeVisible()

    await page.getByRole('combobox', { name: 'View' }).selectOption('day')
    await expect(page.getByRole('cell', { name: 'absent' })).toBeVisible()

    await page.getByRole('combobox', { name: 'View' }).selectOption('student')
    await page.getByLabel('Student').fill('301')
    await expect(page.getByRole('cell', { name: 'E2E-HISTORY-A' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '2026/2027', exact: true })).toBeVisible()
  })

  test('teacher monthly report stays server-backed and opens the printable view', async ({ page }) => {
    await installSession(page, 'teacher')

    await page.route('**/api/classes.php*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { classes: teacherClasses } }),
      })
    })

    let reportUrl = ''
    await page.route('**/api/v1/classes/1/report*', async (route) => {
      reportUrl = route.request().url()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            class: teacherClasses[0],
            month: '2027-01',
            start: '2027-01-01',
            end: '2027-01-31',
            summary: { present_count: 8, absent_count: 2, late_count: 1, excused_count: 0, recorded_count: 11, presence_rate: 72.7 },
            students: [{
              id: 301,
              student_number: 'E2E-301',
              massar_code: 'E2E-MASSAR-301',
              first_name: 'Demo',
              last_name: 'Student',
              birth_date: null,
              present_count: 8,
              absent_count: 2,
              late_count: 1,
              excused_count: 0,
              other_count: 1,
              recorded_count: 11,
              presence_rate: 72.7,
            }],
          },
        }),
      })
    })

    await page.addInitScript(() => {
      window.print = () => { window.__printCalled = true }
    })

    await page.goto('/app/reports?class_id=1&month=2027-01')
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible()
    await expect(page.getByText('72.7%').first()).toBeVisible()
    await expect(page.getByText('Demo Student')).toBeVisible()
    await expect.poll(() => reportUrl).toContain('month=2027-01')
    await page.getByRole('button', { name: 'Print report' }).click()
    await expect.poll(async () => await page.evaluate(() => window.__printCalled === true)).toBe(true)
  })

  test('teacher signature saves, reloads, and clears through the canonical API', async ({ page }) => {
    await installSession(page, 'teacher')

    await page.route('**/api/classes.php*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { classes: teacherClasses } }),
      })
    })

    let storedSignature = null
    let saveRequestHeaders = null

    await page.route('**/api/v1/classes/1/signature', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { signature: storedSignature } }),
        })
        return
      }

      if (route.request().method() === 'POST') {
        saveRequestHeaders = route.request().headers()
        const payload = route.request().postDataJSON()
        expect(payload.signature_data).toMatch(/^data:image\/png;base64,/)
        storedSignature = {
          id: 701,
          teacher_id: 20,
          class_id: 1,
          signature_data: payload.signature_data,
          created_at: '2027-01-12T09:00:00Z',
          updated_at: '2027-01-12T09:00:00Z',
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { signature: storedSignature } }),
        })
        return
      }

      storedSignature = null
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { changed: true } }),
      })
    })

    await page.goto('/app/signatures?class_id=1')
    const canvas = page.getByLabel('Handwritten signature area')
    await expect(canvas).toBeVisible()

    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box.x + 120, box.y + 120)
    await page.mouse.down()
    await page.mouse.move(box.x + 220, box.y + 145)
    await page.mouse.move(box.x + 320, box.y + 105)
    await page.mouse.up()

    await page.getByRole('button', { name: 'Save signature' }).click()
    await expect(page.getByText('Signature saved')).toBeVisible()
    expect(saveRequestHeaders?.['x-csrf-token']).toBe('e2e-csrf')

    await page.reload()
    await expect(page.getByText('Signature saved')).toBeVisible()

    await page.getByRole('button', { name: 'Clear signature' }).click()
    await expect(page.getByRole('button', { name: 'Clear signature' })).toBeDisabled()
  })
})
