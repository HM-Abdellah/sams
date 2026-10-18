import { test, expect } from '@playwright/test'

const classes = [
  {
    id: 1,
    name: 'E2E-2BAC-A',
    level: '2BAC',
    branch: 'SP',
    academic_year_id: 1,
    academic_year_name: '2026/2027',
    academic_year_starts_on: '2026-09-01',
    academic_year_ends_on: '2027-07-31',
  },
  {
    id: 2,
    name: 'E2E-1BAC-B',
    level: '1BAC',
    branch: 'SVT',
    academic_year_id: 1,
    academic_year_name: '2026/2027',
    academic_year_starts_on: '2026-09-01',
    academic_year_ends_on: '2027-07-31',
  },
]

const students = [
  {
    id: 1,
    student_number: 'A001',
    massar_code: 'MASSAR001',
    birth_date: '2009-01-10',
    first_name: 'Jean',
    last_name: 'Dupont',
    status: 'active',
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T08:00:00Z',
  },
  {
    id: 2,
    student_number: 'A002',
    massar_code: 'MASSAR002',
    birth_date: '2009-02-20',
    first_name: 'Marie',
    last_name: 'Martin',
    status: 'active',
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T08:00:00Z',
  },
]

async function mockTeacherSession(page) {
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
      body: JSON.stringify({ success: true, data: { classes } }),
    })
  })

  await page.route('**/api/students.php?**', async (route) => {
    if (route.request().method() !== 'GET') return
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { students } }),
    })
  })
}

test.describe('frontend Phase 36 teacher workspaces', () => {
  test.beforeEach(async ({ page }) => {
    await mockTeacherSession(page)
  })

  test('teacher home provides class-centered entry points without unsupported daily data', async ({ page }) => {
    await page.goto('/app/teacher')

    await expect(page.getByRole('heading', { name: 'Teacher Workspace' })).toBeVisible()
    await expect(page.getByText('2 assigned classes')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open attendance E2E-2BAC-A' })).toHaveAttribute(
      'href',
      '/app/attendance?class_id=1',
    )
    await expect(page.locator('main a[href="/app/students?class_id=1"]').first()).toHaveAttribute('href', '/app/students?class_id=1')
  })

  test('my classes exposes the server-backed class context and workspace entry', async ({ page }) => {
    await page.goto('/app/classes')

    await expect(page.getByRole('heading', { name: 'Classes' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'E2E-2BAC-A' })).toBeVisible()
    await expect(page.getByText('2BAC · SP')).toBeVisible()
    await expect(page.getByText('2026/2027').first()).toBeVisible()

    const viewLinks = page.getByRole('link', { name: 'View details' })
    await expect(viewLinks).toHaveCount(2)
    await viewLinks.first().click()

    await expect(page).toHaveURL('/app/classes/1')
    await expect(page.getByRole('heading', { name: 'E2E-2BAC-A' })).toBeVisible()
  })

  test('class workspace keeps class context across operational workflows', async ({ page }) => {
    await page.goto('/app/classes/1')

    await expect(page.getByRole('heading', { name: 'Class summary' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Class roster' })).toBeVisible()
    await expect(page.getByText('Jean Dupont')).toBeVisible()

    const workspace = page.getByRole('main')
    await expect(workspace.locator('a[href="/app/attendance?class_id=1"]')).toHaveCount(1)
    await expect(workspace.locator('a[href="/app/students?class_id=1"]')).toHaveCount(1)
    await expect(workspace.locator('a[href="/app/signatures?class_id=1"]')).toHaveCount(1)
    await expect(workspace.locator('a[href="/app/reports?class_id=1"]')).toHaveCount(1)
  })
})