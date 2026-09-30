import { test, expect } from '@playwright/test'

const initialStudent = {
  id: 301,
  student_number: 'E2E-301',
  massar_code: 'E2E-MASSAR-301',
  birth_date: null,
  first_name: 'Demo',
  last_name: 'Student',
  status: 'active',
  created_at: '2026-09-29T08:00:00Z',
  updated_at: '2026-09-29T08:00:00Z',
}

const schoolClass = {
  id: 1,
  name: 'E2E-STATE-A',
  level: '2BAC',
  branch: 'SP',
  academic_year_id: 1,
  academic_year_name: '2026/2027',
  academic_year_starts_on: '2026-09-01',
  academic_year_ends_on: '2027-07-31',
}

async function installSession(page) {
  await page.route('**/api/v1/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          authenticated: true,
          user: { id: 20, school_id: 30, employee_id: 'teacher.e2e', full_name: 'E2E Teacher', role: 'teacher', account_status: 'active' },
          csrf: 'e2e-csrf',
        },
      }),
    })
  })
  await page.route('**/api/classes.php', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { classes: [schoolClass] } }) })
  })
}

async function openStudents(page) {
  await page.goto('/app/students?class_id=1')
  await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible()
  await expect(page.getByText('Demo Student')).toBeVisible()
}
test.describe('frontend Phase 16 UI state system', () => {
  test('keeps confirmed roster visible during a delayed mutation refresh', async ({ page }) => {
    await installSession(page)
    let students = [structuredClone(initialStudent)]
    let mutationStarted = false
    let releaseRefresh
    const refreshReleased = new Promise((resolve) => { releaseRefresh = resolve })

    await page.route('**/api/students.php*', async (route) => {
      if (route.request().method() === 'GET') {
        if (mutationStarted) await refreshReleased
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { students } }) })
        return
      }

      const payload = route.request().postDataJSON()
      expect(payload.action).toBe('create')
      mutationStarted = true
      students = [...students, { ...structuredClone(initialStudent), id: 302, student_number: 'E2E-302', massar_code: 'E2E-MASSAR-302', first_name: 'New', last_name: 'Student' }]
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 302 } }) })
    })

    await openStudents(page)
    await page.getByRole('button', { name: 'Add student' }).click()
    await page.getByLabel('First name').fill('New')
    await page.getByLabel('Last name').fill('Student')
    await page.getByLabel('Student No.').fill('E2E-302')
    await page.getByLabel('Massar code').fill('E2E-MASSAR-302')
    await page.getByLabel('Birth date').fill('2009-03-03')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('status').filter({ hasText: 'Refreshing…' })).toBeVisible()
    await expect(page.getByText('Demo Student')).toBeVisible()
    await expect(page.getByText('New Student')).toHaveCount(0)

    releaseRefresh()
    await expect(page.getByText('New Student')).toBeVisible()
    await expect(page.getByText('2 / 2 students')).toBeVisible()
  })

  test('keeps stale roster visible and exposes retry when refresh confirmation fails', async ({ page }) => {
    await installSession(page)
    let mutationStarted = false

    await page.route('**/api/students.php*', async (route) => {
      if (route.request().method() === 'GET') {
        if (!mutationStarted) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { students: [structuredClone(initialStudent)] } }) })
          return
        }
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Synthetic refresh failure.' }) })
        return
      }

      mutationStarted = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: initialStudent.id } }) })
    })

    await openStudents(page)
    await page.getByRole('button', { name: 'View details' }).click()
    await page.getByRole('button', { name: 'Edit student' }).last().click()
    await page.getByLabel('First name').fill('Demo Updated')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('alert').filter({ hasText: 'Synthetic refresh failure.' })).toBeVisible()
    await expect(page.getByText('Demo Student')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible()
  })
})
