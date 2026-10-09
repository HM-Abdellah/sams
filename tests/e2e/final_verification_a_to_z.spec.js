import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const ADMIN_CODE = process.env.SAMS_E2E_ADMIN_SAMS_CODE
const ADMIN_PASSWORD = process.env.SAMS_E2E_PASSWORD
const TEACHER_CODE = process.env.SAMS_E2E_TEACHER_SAMS_CODE
const TEACHER_PASSWORD = process.env.SAMS_E2E_TEACHER_PASSWORD

function requireCredentials() {
  if (!ADMIN_CODE || !ADMIN_PASSWORD || !TEACHER_CODE || !TEACHER_PASSWORD) {
    throw new Error('Final A-Z verification requires SAMS_E2E_ADMIN_SAMS_CODE, SAMS_E2E_PASSWORD, SAMS_E2E_TEACHER_SAMS_CODE, and SAMS_E2E_TEACHER_PASSWORD.')
  }
}

async function login(page, code, password) {
  await page.goto('login')
  await page.getByLabel('SAMS Code').fill(code)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/app\/(?:admin\/dashboard|teacher)$/)
}

async function logout(page) {
  const button = page.getByRole('button', { name: /sign out/i })
  if (await button.count()) {
    await button.first().click()
    await expect(page).toHaveURL(/\/login$/)
  }
}

async function expectPageHealthy(page) {
  await expect(page.locator('body')).not.toContainText(/(server error|internal server error|uncaught|something went wrong)/i)
}

async function expectNoOverflow(page) {
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }))
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport)
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewport)
}

async function firstClassId(page) {
  const href = await page.locator('a[href*="/app/classes/"]').first().getAttribute('href')
  const match = href?.match(/\/app\/classes\/(\d+)/)
  if (!match) throw new Error('Unable to discover a teacher class id from My Classes.')
  return Number(match[1])
}

async function assertA11y(page, label) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations, label + ' accessibility violations').toEqual([])
}

async function visual(page, name) {
  const path = 'artifacts/final-verification/' + name + '.png'
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
  if (process.env.SAMS_VISUAL_ASSERT === '1') {
    await expect(page).toHaveScreenshot(name + '.png', {
      animations: 'disabled',
      maxDiffPixelRatio: Number(process.env.SAMS_VISUAL_MAX_DIFF || '0.01'),
    })
  }
}

const MARK_STATUS_NAMES = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
}

function statusFromLabel(label) {
  for (const [status, name] of Object.entries(MARK_STATUS_NAMES)) {
    if (label?.endsWith('— ' + name)) return status
  }
  return 'clear'
}

async function chooseMarkStatus(page, status) {
  const name = MARK_STATUS_NAMES[status] || MARK_STATUS_NAMES.present
  await page.getByRole('group', { name: 'Mark as' }).getByRole('button', { name }).click()
}

async function restoreCell(page, cell, originalStatus) {
  const currentLabel = await cell.getAttribute('aria-label')
  const currentStatus = statusFromLabel(currentLabel)
  if (currentStatus === originalStatus) return

  if (originalStatus === 'clear') {
    const statusToClear = currentStatus === 'clear' ? 'present' : currentStatus
    await chooseMarkStatus(page, statusToClear)
    await cell.click()
    return
  }

  await chooseMarkStatus(page, originalStatus)
  await cell.click()
}

test.describe('SAMS Final A-Z Verification', () => {
  test.beforeAll(() => { requireCredentials(); mkdirSync('artifacts/final-verification', { recursive: true }) })

  test.beforeEach(async ({ page }, testInfo) => {
    const title = testInfo.title
    if (['01 Login Admin', '15 Login Teacher', '24 Online presence', '31 DB consistency', '34 Final demo flow'].includes(title)) return
    if (/^(02|03|04|05|06|07|08|09|10|11|12|13|14|27|29|30|33) /.test(title)) {
      await login(page, ADMIN_CODE, ADMIN_PASSWORD)
      return
    }
    if (/^(16|17|18|19|20|21|22|23|25|26|28|32) /.test(title)) {
      await login(page, TEACHER_CODE, TEACHER_PASSWORD)
    }
  })

  test('01 Login Admin', async ({ page }) => {
    await login(page, ADMIN_CODE, ADMIN_PASSWORD)
    await expect(page).toHaveURL(/\/app\/admin\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('02 Dashboard', async ({ page }) => {
    await page.goto('app/admin/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    for (const label of ['Active students', 'Active classes', 'Active teachers', 'Presence rate']) {
      await expect(page.getByText(new RegExp(label, 'i')).first()).toBeVisible()
    }
    await expectPageHealthy(page)
  })

  test('03 Classes', async ({ page }) => {
    await page.goto('app/admin/classes')
    await expect(page.getByRole('heading', { name: 'Classes' })).toBeVisible()
    await expectPageHealthy(page)
  })

  test('04 Students', async ({ page }) => {
    await page.goto('app/admin/students')
    await expect(page.getByRole('heading', { name: 'Students', level: 1 })).toBeVisible()
    await expectPageHealthy(page)
  })

  test('05 Teachers', async ({ page }) => {
    await page.goto('app/admin/teachers')
    await expect(page.getByRole('heading', { name: 'Teachers' })).toBeVisible()
    await expect(page.getByRole('table', { name: /Teacher directory/i })).toBeVisible()
    await expectPageHealthy(page)
  })

  test('06 Users', async ({ page }) => {
    await page.goto('app/admin/users')
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
    await expectPageHealthy(page)
  })

  test('07 Onboarding', async ({ page }) => {
    await page.goto('app/admin/onboarding')
    await expect(page.getByRole('heading', { name: /onboarding/i }).first()).toBeVisible()
    await expectPageHealthy(page)
  })

  test('08 Subjects', async ({ page }) => {
    await page.goto('app/admin/teachers')
    await expect(page.getByRole('heading', { name: /Subjects/i })).toBeVisible()
    await expect(page.getByRole('table', { name: /Subjects/i })).toBeVisible()
    await expectPageHealthy(page)
  })

  test('09 Assignments', async ({ page }) => {
    await page.goto('app/admin/teachers')
    await expect(page.getByRole('heading', { name: /Teaching assignments/i })).toBeVisible()
    await expectPageHealthy(page)
  })

  test('10 Academic Years', async ({ page }) => {
    await page.goto('app/admin/academic-years')
    await expect(page.getByRole('heading', { name: /Academic years/i })).toBeVisible()
    await expectPageHealthy(page)
  })

  test('11 Imports', async ({ page }) => {
    await page.goto('app/admin/imports')
    await expect(page.getByRole('heading', { name: /Imports/i })).toBeVisible()
    await expectPageHealthy(page)
  })

  test('12 Archive', async ({ page }) => {
    await page.goto('app/admin/archive')
    await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible()
    await expectPageHealthy(page)
  })

  test('13 Audit', async ({ page }) => {
    await page.goto('app/admin/audit')
    await expect(page.getByRole('heading', { name: 'Audit' })).toBeVisible()
    await expectPageHealthy(page)
  })

  test('14 Logout', async ({ page }) => {
    await logout(page)
  })

  test('15 Login Teacher', async ({ page }) => {
    await login(page, TEACHER_CODE, TEACHER_PASSWORD)
    await expect(page).toHaveURL(/\/app\/teacher$/)
    await expect(page.getByRole('heading', { name: 'Teacher workspace' })).toBeVisible()
  })

  test('16 Teacher Home', async ({ page }) => {
    await page.goto('app/teacher')
    await expect(page.getByRole('heading', { name: 'Teacher workspace' })).toBeVisible()
    await expectPageHealthy(page)
  })

  test('17 My Classes', async ({ page }) => {
    await page.goto('app/classes')
    await expect(page.getByRole('heading', { name: 'Classes' })).toBeVisible()
    await expect(page.locator('a[href*="/app/classes/"]').first()).toBeVisible()
    await expectPageHealthy(page)
  })

  test('18 Class Workspace', async ({ page }) => {
    await page.goto('app/classes')
    const classId = await firstClassId(page)
    await page.goto('app/classes/' + classId)
    await expect(page.locator('main')).toContainText(/class|students|attendance/i)
    await expectPageHealthy(page)
  })

  test('19 Attendance', async ({ page }) => {
    await page.goto('app/classes')
    const classId = await firstClassId(page)
    await page.goto('app/attendance?class_id=' + classId)
    await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Period 1/i })).toBeVisible()
    await expectPageHealthy(page)
  })

  test('20 Attendance persistence', async ({ page }) => {
    await page.goto('app/classes')
    const classId = await firstClassId(page)
    await page.goto('app/attendance?class_id=' + classId + '&week_start=2026-09-21')
    const row = page.locator('[data-attendance-row]:visible').first()
    await expect(row).toBeVisible()
    const button = row.locator('button[data-attendance-period="8"]').first()
    const before = await button.getAttribute('aria-label')
    const originalStatus = statusFromLabel(before)
    await chooseMarkStatus(page, 'present')
    await button.click()
    await expect(page.getByText('Saved and confirmed by the server.')).toBeVisible()
    await expect(button).toHaveAttribute('aria-label', /Period 8.*Present/)
    await page.reload()
    const reloaded = page.locator('[data-attendance-row]:visible').first().locator('button[data-attendance-period="8"]').first()
    await expect(reloaded).toHaveAttribute('aria-label', /Period 8.*Present/)
    await restoreCell(page, reloaded, originalStatus)
    await expect(page.getByText('Saved and confirmed by the server.')).toBeVisible()
  })

  test('21 Attendance correction workflow', async ({ page }) => {
    await page.goto('app/classes')
    const classId = await firstClassId(page)
    await page.goto('app/attendance?class_id=' + classId + '&week_start=2026-09-21')
    const cell = page.locator('[data-attendance-row]:visible').first().locator('button[data-attendance-period="1"]').first()
    const originalStatus = statusFromLabel(await cell.getAttribute('aria-label'))
    await chooseMarkStatus(page, 'absent')
    await cell.click()
    await expect(page.getByText('Saved and confirmed by the server.')).toBeVisible()
    await expect(cell).toHaveAttribute('aria-label', /Period 1.*Absent/)
    await chooseMarkStatus(page, 'present')
    await cell.click()
    await expect(page.getByText('Saved and confirmed by the server.')).toBeVisible()
    await expect(cell).toHaveAttribute('aria-label', /Period 1.*Present/)
    await restoreCell(page, cell, originalStatus)
    await expect(page.getByText('Saved and confirmed by the server.')).toBeVisible()
  })

  test('22 Reports', async ({ page }) => {
    await page.goto('app/reports')
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible()
    await expectPageHealthy(page)
  })

  test('23 Signatures', async ({ page }) => {
    await page.goto('app/signatures')
    await expect(page.getByRole('heading', { name: 'Signatures' })).toBeVisible()
    await expectPageHealthy(page)
  })

  test('24 Online presence', async ({ page, browser }) => {
    await login(page, ADMIN_CODE, ADMIN_PASSWORD)
    const teacherContext = await browser.newContext({ baseURL: process.env.SAMS_BASE_URL || 'http://localhost:5173/', locale: 'en-US' })
    const teacherPage = await teacherContext.newPage()
    try {
      await login(teacherPage, TEACHER_CODE, TEACHER_PASSWORD)
      await expect(teacherPage).toHaveURL(/\/app\/teacher$/)
      await page.goto('app/admin/teachers')
      const teacherRow = page.getByRole('row').filter({ hasText: /teacher/i }).last()
      await expect(teacherRow).toBeVisible()
      await expect(teacherRow).toContainText(/Online|En ligne|متصل/i)
    } finally {
      await teacherContext.close()
    }
  })

  test('25 Mobile 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto('app/attendance')
    await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible()
    await expectNoOverflow(page)
  })

  test('26 Tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('app/attendance')
    await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible()
    await expectNoOverflow(page)
  })

  test('27 Desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('app/admin/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expectNoOverflow(page)
  })

  test('28 RTL', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('app/attendance')
    const language = page.locator('#sams-language')
    if (await language.count()) await language.selectOption('ar')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expectNoOverflow(page)
  })

  test('29 Accessibility', async ({ page, browser }) => {
    await page.goto('app/admin/dashboard')
    await assertA11y(page, 'Admin Dashboard')
    await page.goto('app/admin/teachers')
    await assertA11y(page, 'Admin Teachers')

    const teacherContext = await browser.newContext({ baseURL: process.env.SAMS_BASE_URL || 'http://localhost:5173/', locale: 'en-US' })
    const teacherPage = await teacherContext.newPage()
    try {
      await login(teacherPage, TEACHER_CODE, TEACHER_PASSWORD)
      await teacherPage.goto('app/attendance')
      await assertA11y(teacherPage, 'Teacher Attendance')
    } finally {
      await teacherContext.close()
    }
  })

  test('30 API Auth Security', async ({ page, request }) => {
    await page.goto('app/admin/dashboard')
    const health = await request.get('api/v1/health')
    expect(health.status()).toBe(200)
    expect(health.headers()['x-content-type-options']).toBe('nosniff')
    expect(health.headers()['x-frame-options']).toBe('DENY')
    const unauthenticatedAdmin = await request.get('api/v1/admin/dashboard')
    expect([401, 403]).toContain(unauthenticatedAdmin.status())
    const adminState = await page.request.get('api/v1/auth/session')
    expect(adminState.status()).toBe(200)
    const adminJson = await adminState.json()
    expect(adminJson.data?.authenticated).toBe(true)
    expect(adminJson.data?.user?.role).toBe('admin')
  })

  test('31 DB consistency', async () => {
    const useContainer = process.env.SAMS_FINAL_DB_CHECK_IN_CONTAINER === '1'
    const command = useContainer ? 'docker' : (process.platform === 'win32' ? 'php.exe' : 'php')
    const args = useContainer
      ? ['exec', '-e', 'SAMS_ALLOW_EXAMPLE_CONFIG=1', 'sams-final-verify-app', 'php', '/workspace/tests/final_verification_db.php']
      : ['tests/final_verification_db.php']
    try {
      const output = execFileSync(command, args, {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      expect(output).toContain('[PASS] Final database consistency audit completed.')
    } catch (error) {
      const failure = error && typeof error === 'object'
        ? String(error.stdout || '') + String(error.stderr || '')
        : String(error)
      throw new Error('Database consistency audit failed.\\n' + failure)
    }
  })

  test('32 Concurrency', async ({ page }) => {
    await page.goto('app/classes')
    const classId = await firstClassId(page)

    const student = { id: 990001, first_name: 'Concurrency', last_name: 'Probe' }
    let status = null
    let revision = 5
    let conflictOnce = true

    await page.route('**/api/v1/classes/' + classId + '/attendance?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            class_id: classId,
            week_start: '2026-09-21',
            week_end: '2026-09-26',
            students: [student],
            attendance: status === null ? [] : [{
              id: 990002,
              enrollment_id: 990001,
              student_id: student.id,
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

    await page.route('**/api/v1/classes/' + classId + '/attendance/bulk', async (route) => {
      const payload = route.request().postDataJSON()
      if (conflictOnce) {
        conflictOnce = false
        status = 'late'
        revision = 6
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
          student_id: student.id,
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
            revisions: [{ attendance_date: '2026-09-21', period: 1, revision: 7 }],
          },
        }),
      })
    })

    await page.goto('app/attendance?class_id=' + classId + '&week_start=2026-09-21')
    await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible()

    await page.getByRole('group', { name: 'Mark as' }).getByRole('button', { name: 'Absent' }).click()
    await page.locator('[data-attendance-row]:visible').first().locator('button[data-attendance-period="1"]').click()

    await expect(page.getByText('The register was updated by another teacher.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Keep my changes' })).toBeVisible()
    await expect(page.locator('[data-attendance-row]:visible').first().locator('button[data-attendance-period="1"]')).toHaveAttribute('aria-label', /Period 1.*Late/)

    await page.getByRole('button', { name: 'Keep my changes' }).click()
    await expect(page.getByText('Saved and confirmed by the server.')).toBeVisible()
    await expect(page.locator('[data-attendance-row]:visible').first().locator('button[data-attendance-period="1"]')).toHaveAttribute('aria-label', /Period 1.*Absent/)
  })

  test('33 Visual regression', async ({ page, browser }) => {
    await page.goto('app/admin/dashboard')
    await visual(page, 'admin-dashboard')
    await page.goto('app/admin/teachers')
    await visual(page, 'admin-teachers')

    const teacherContext = await browser.newContext({ baseURL: process.env.SAMS_BASE_URL || 'http://localhost:5173/', locale: 'en-US' })
    const teacherPage = await teacherContext.newPage()
    try {
      await login(teacherPage, TEACHER_CODE, TEACHER_PASSWORD)
      await teacherPage.goto('app/attendance')
      await visual(teacherPage, 'teacher-attendance')
    } finally {
      await teacherContext.close()
    }
  })

  test('34 Final demo flow', async ({ page }) => {
    await logout(page)
    await login(page, TEACHER_CODE, TEACHER_PASSWORD)
    await expect(page).toHaveURL(/\/app\/teacher$/)
    await page.goto('app/classes')
    const classId = await firstClassId(page)
    await page.goto('app/attendance?class_id=' + classId)
    await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible()
    await page.goto('app/reports')
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible()
    await page.goto('app/signatures')
    await expect(page.getByRole('heading', { name: 'Signatures' })).toBeVisible()
    await logout(page)
    await login(page, ADMIN_CODE, ADMIN_PASSWORD)
    await expect(page).toHaveURL(/\/app\/admin\/dashboard$/)
    await page.goto('app/admin/archive')
    await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible()
  })
})

