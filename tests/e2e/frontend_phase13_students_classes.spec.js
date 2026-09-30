import { test, expect } from '@playwright/test'

const baseStudents = [
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
  {
    id: 3,
    student_number: 'A003',
    massar_code: 'MASSAR003',
    birth_date: null,
    first_name: 'Youssef',
    last_name: 'Alaoui',
    status: 'inactive',
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-10T08:00:00Z',
  },
]

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
test.describe('frontend Phase 13 students and classes', () => {
  let students

  test.beforeEach(async ({ page }) => {
    students = structuredClone(baseStudents)

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
      const request = route.request()
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { students } }),
        })
        return
      }

      const payload = request.postDataJSON()
      if (payload.action === 'create') {
        const nextId = Math.max(...students.map((student) => student.id)) + 1
        students.push({
          id: nextId,
          student_number: payload.student_number ?? null,
          massar_code: payload.massar_code ?? null,
          birth_date: payload.birth_date ?? null,
          first_name: payload.first_name,
          last_name: payload.last_name,
          status: 'active',
          created_at: '2026-09-29T08:00:00Z',
          updated_at: '2026-09-29T08:00:00Z',
        })
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { id: nextId } }),
        })
        return
      }

      if (payload.action === 'update') {
        const student = students.find((item) => item.id === payload.id)
        expect(student).toBeDefined()
        Object.assign(student, {
          student_number: payload.student_number ?? null,
          massar_code: payload.massar_code ?? null,
          birth_date: payload.birth_date ?? null,
          first_name: payload.first_name,
          last_name: payload.last_name,
          updated_at: '2026-09-29T08:05:00Z',
        })
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { id: student.id } }),
        })
        return
      }

      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Unknown action.' }),
      })
    })
    await page.goto('/app/classes')
    await expect(page.getByRole('heading', { name: 'Classes' })).toBeVisible()
  })

  test('class list and class details expose operational academic context', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'E2E-2BAC-A' })).toBeVisible()
    await expect(page.getByText('2026/2027').first()).toBeVisible()
    await expect(page.getByText('2BAC · SP').first()).toBeVisible()

    await page.getByRole('link', { name: 'View details' }).first().click()
    await expect(page).toHaveURL(/\/app\/classes\/1$/)
    await expect(page.getByRole('heading', { name: 'E2E-2BAC-A' })).toBeVisible()
    await expect(page.getByText('Class summary')).toBeVisible()
    await expect(page.getByText('2026/2027').first()).toBeVisible()
    await expect(page.getByText('Attendance history remains tied to enrollment periods on the server. This view shows the current operational context.')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Class roster' })).toBeVisible()
    await expect(page.getByText('3').last()).toBeVisible()
  })

  test('student list search, details, create and edit use the server-authoritative refresh', async ({ page }) => {
    await page.goto('/app/students?class_id=1')
    await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible()
    await expect(page.getByText('3 / 3 students')).toBeVisible()

    await page.getByRole('searchbox').fill('MASSAR002')
    await expect(page.getByText('Marie Martin')).toBeVisible()
    await expect(page.getByText('Jean Dupont')).toHaveCount(0)

    await page.getByRole('button', { name: 'View details' }).click()
    await expect(page.getByRole('heading', { name: 'Student details' })).toBeVisible()
    await expect(page.getByRole('dialog').getByText('Marie Martin').first()).toBeVisible()
    await expect(page.getByRole('dialog').getByText('E2E-2BAC-A').first()).toBeVisible()
    await expect(page.getByRole('dialog').getByText('2026/2027').first()).toBeVisible()
    await expect(page.getByRole('dialog').getByText('Attendance history remains').first()).toBeVisible()

    await page.getByRole('button', { name: 'Edit student' }).last().click()
    await expect(page.getByRole('heading', { name: 'Edit student' })).toBeVisible()
    await page.getByLabel('First name').fill('Marie Updated')

    const editRequest = page.waitForRequest(
      (request) => request.url().includes('/api/students.php?class_id=1') && request.method() === 'POST',
    )
    await page.getByRole('button', { name: 'Save' }).click()
    const edit = await editRequest
    expect(edit.postDataJSON()).toEqual(expect.objectContaining({
      action: 'update',
      id: 2,
      first_name: 'Marie Updated',
    }))
    await expect(page.getByText('Marie Updated')).toBeVisible()

    await page.getByRole('searchbox').fill('')
    await page.getByRole('button', { name: 'Add student' }).click()
    await expect(page.getByRole('heading', { name: 'Add student' })).toBeVisible()
    await page.getByLabel('First name').fill('New')
    await page.getByLabel('Last name').fill('Student')
    await page.getByLabel('Student No.').fill('A004')
    await page.getByLabel('Massar code').fill('MASSAR004')
    await page.getByLabel('Birth date').fill('2009-03-03')

    const createRequest = page.waitForRequest(
      (request) => request.url().includes('/api/students.php?class_id=1') && request.method() === 'POST',
    )
    await page.getByRole('button', { name: 'Save' }).click()
    const create = await createRequest
    expect(create.postDataJSON()).toEqual(expect.objectContaining({
      action: 'create',
      first_name: 'New',
      last_name: 'Student',
      massar_code: 'MASSAR004',
    }))
    await expect(page.getByText('New Student')).toBeVisible()
    await expect(page.getByText('4 / 4 students')).toBeVisible()
  })
  test('class context stays in URL state and teacher language remains RTL-safe', async ({ page }) => {
    await page.goto('/app/students?class_id=2')
    await expect(page).toHaveURL(/\/app\/students\?class_id=2$/)
    await expect(page.getByRole('heading', { name: 'E2E-1BAC-B' })).toBeVisible()

    const yearText = page.getByText('2026/2027').last()
    await expect(yearText).toBeVisible()

    await page.getByRole('combobox', { name: 'Select a class' }).selectOption('1')
    await expect(page).toHaveURL(/\/app\/students\?class_id=1$/)
    await expect(page.getByRole('heading', { name: 'E2E-2BAC-A' })).toBeVisible()

    const html = page.locator('html')
    await page.getByRole('combobox', { name: 'Language' }).selectOption('ar')
    await expect(html).toHaveAttribute('lang', 'ar')
    await expect(html).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { name: 'التلاميذ' })).toBeVisible()
  })
})
