import { test, expect } from '@playwright/test'

const teacherCode = process.env.SAMS_E2E_TEACHER_SAMS_CODE || 'T100002'
const teacherPassword = process.env.SAMS_E2E_TEACHER_PASSWORD
const adminCode = process.env.SAMS_E2E_ADMIN_SAMS_CODE || 'A100001'
const adminPassword = process.env.SAMS_E2E_PASSWORD

if (!teacherPassword || !adminPassword) {
  throw new Error('Final demo rehearsal requires SAMS_E2E teacher/admin password environment variables.')
}

async function login(page, samsCode, password) {
  await page.goto('/sams/login')
  await page.getByLabel('SAMS Code').fill(samsCode)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test.describe('Final demo real-backend rehearsal', () => {
  test('teacher attendance mutation flows into report, then admin archive reads the same state', async ({ page }) => {
    await login(page, teacherCode, teacherPassword)
    await expect(page).toHaveURL(/\/sams\/app\/teacher$/)
    await expect(page.getByRole('heading', { name: 'Teacher workspace' })).toBeVisible()

    await page.goto('/sams/app/attendance?class_id=1&week_start=2026-09-21')
    await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible()
    await expect(page.locator('#attendance-class')).toHaveValue('1')

    const dayGroup = page.getByRole('group', { name: 'Attendance register' }).first()
    await dayGroup.getByRole('button').nth(4).click()

    await page.getByRole('group', { name: 'Mark as' }).getByRole('button', { name: 'Absent' }).click()
    const jeanRow = page.locator('[data-attendance-row]:visible').filter({ hasText: 'Jean Dupont' }).first()
    await expect(jeanRow).toBeVisible()
    const periodOne = jeanRow.locator('button[data-attendance-period="1"]')
    await expect(periodOne).toHaveAttribute('aria-label', /Period 1.*Present/)
    await periodOne.click()
    await expect(periodOne).toHaveAttribute('aria-label', /Period 1.*Absent/)
    await expect(page.getByText('Saved and confirmed by the server.')).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible()
    await page.getByRole('group', { name: 'Attendance register' }).first().getByRole('button').nth(4).click()
    const jeanRowAfterReload = page.locator('[data-attendance-row]:visible').filter({ hasText: 'Jean Dupont' }).first()
    await expect(jeanRowAfterReload).toBeVisible()
    await expect(jeanRowAfterReload.locator('button[data-attendance-period="1"]')).toHaveAttribute('aria-label', /Period 1.*Absent/)

    await page.goto('/sams/app/reports?class_id=1&month=2026-09')
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible()
    await expect(page.getByText('25%', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('8', { exact: true }).first()).toBeVisible()

    await page.goto('/sams/app/signatures?class_id=1')
    await expect(page.getByRole('heading', { name: 'Signatures' })).toBeVisible()
    await expect(page.getByText('Signature saved', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/sams\/login$/)

    await login(page, adminCode, adminPassword)
    await expect(page).toHaveURL(/\/sams\/app\/admin\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

    await page.goto('/sams/app/admin/archive?class_id=1&view=month&month=2026-09')
    await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /E2E-2BAC-A/ })).toBeVisible()
    const archiveStudent = page.getByRole('row').filter({ hasText: 'Jean Dupont' }).last()
    await expect(archiveStudent).toContainText('25%')
    await expect(archiveStudent).toContainText('8')
  })

  test('real backend attendance remains usable on narrow mobile and supports RTL language switching', async ({ page }) => {
    await login(page, teacherCode, teacherPassword)
    await expect(page).toHaveURL(/\/sams\/app\/teacher$/)

    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto('/sams/app/attendance?class_id=1&week_start=2026-09-21')
    await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible()

    const metrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }))
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport)
    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewport)

    await expect(page.locator('[data-attendance-row]:visible').filter({ hasText: 'Jean Dupont' })).toBeVisible()
    const periodSelector = page.getByRole('group', { name: 'Period' })
    await expect(periodSelector.getByRole('button')).toHaveCount(8)
    await periodSelector.getByRole('button', { name: /Period 8/ }).click()

    const statusCell = page.locator('button.sams-touch-cell:visible').first()
    const cellBox = await statusCell.boundingBox()
    expect(cellBox).not.toBeNull()
    expect(cellBox.width).toBeGreaterThanOrEqual(48)
    expect(cellBox.height).toBeGreaterThanOrEqual(48)

    await page.locator('#sams-language').selectOption('ar')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('#sams-language')).toHaveValue('ar')
    await expect(page.getByRole('button', { name: 'فتح قائمة التنقل' })).toBeVisible()

    const rtlMetrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }))
    expect(rtlMetrics.documentWidth).toBeLessThanOrEqual(rtlMetrics.viewport)
    expect(rtlMetrics.bodyWidth).toBeLessThanOrEqual(rtlMetrics.viewport)
  })


  test('admin real backend exposes every operational management workspace', async ({ page }) => {
    await login(page, adminCode, adminPassword)
    await expect(page).toHaveURL(/\/sams\/app\/admin\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

    await page.goto('/sams/app/admin/classes')
    await expect(page.getByRole('heading', { name: 'Classes' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'E2E-2BAC-A', exact: true })).toBeVisible()

    await page.goto('/sams/app/admin/students?class_id=1')
    await expect(page.getByRole('main').getByRole('heading', { name: 'Students', exact: true }).first()).toBeVisible()
    await expect(page.getByText('Jean Dupont', { exact: true })).toBeVisible()

    await page.goto('/sams/app/admin/teachers')
    await expect(page.getByRole('heading', { name: 'Teachers' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Teacher directory' }).getByRole('row').filter({ hasText: 'E2E Teacher' }).last()).toBeVisible()

    await page.goto('/sams/app/admin/users')
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
    await expect(page.getByText('teacher.e2e', { exact: true }).first()).toBeVisible()

    await page.goto('/sams/app/admin/academic-years')
    await expect(page.getByRole('heading', { name: 'Academic years' })).toBeVisible()
    await expect(page.getByText('2026/2027', { exact: true }).first()).toBeVisible()

    await page.goto('/sams/app/admin/audit')
    await expect(page.getByRole('heading', { name: 'Audit' })).toBeVisible()
  })

})
