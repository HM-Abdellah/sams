import { test, expect } from '@playwright/test'

const teacherCode = process.env.SAMS_E2E_TEACHER_SAMS_CODE || 'T100002'
const teacherPassword = process.env.SAMS_E2E_TEACHER_PASSWORD || 'e2e-teacher-password-2026'
const adminCode = process.env.SAMS_E2E_ADMIN_SAMS_CODE || 'A100001'
const adminPassword = process.env.SAMS_E2E_PASSWORD || 'e2e-admin-password-2026'

async function login(page, samsCode, password) {
  await page.goto('/sams/login')
  await page.getByLabel('SAMS Code').fill(samsCode)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test.describe('frontend Phase 22 real backend smoke', () => {
  test('teacher can authenticate against PHP and reach the reconstructed workspace', async ({ page }) => {
    await login(page, teacherCode, teacherPassword)
    await expect(page).toHaveURL(/\/sams\/app\/teacher$/)
    await expect(page.getByRole('heading', { name: 'Teacher workspace' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'E2E-2BAC-A' })).toBeVisible()

    await page.getByRole('link', { name: 'Open attendance' }).first().click()
    await expect(page).toHaveURL(/\/sams\/app\/attendance/)
    await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible()
  })
  test('admin can authenticate against PHP and reach the reconstructed console', async ({ page }) => {
    await login(page, adminCode, adminPassword)
    await expect(page).toHaveURL(/\/sams\/app\/admin\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'E2E-2BAC-A', exact: true })).toBeVisible()
  })

  test('logout invalidates the reconstructed application session', async ({ page }) => {
    await login(page, teacherCode, teacherPassword)
    await expect(page).toHaveURL(/\/sams\/app\/teacher$/)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/sams\/login$/)
    await page.goto('/sams/app/teacher')
    await expect(page).toHaveURL(/\/sams\/login$/)
  })
})
