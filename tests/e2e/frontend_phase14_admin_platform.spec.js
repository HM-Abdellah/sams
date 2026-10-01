import { test, expect } from '@playwright/test'

test.describe('frontend Phase 14 admin platform', () => {
  let role
  let classes
  let teachers
  let subjects
  let teachings
  let users
  let academicYears
  let onboarding
  let importStatus
  let uploadContentType
  let auditQuery
  let studentsByClass

  test.beforeEach(async ({ page }) => {
    role = 'admin'
    classes = [
      { id: 1, name: 'E2E-2BAC-A', level: '2BAC', branch: 'SP', academic_year_id: 1, is_active: 1, academic_year_name: '2026/2027', academic_year_active: 1, student_count: 40, teacher_count: 1 },
      { id: 2, name: 'E2E-1BAC-B', level: '1BAC', branch: 'SVT', academic_year_id: 1, is_active: 1, academic_year_name: '2026/2027', academic_year_active: 1, student_count: 0, teacher_count: 0 },
    ]
    teachers = [
      { id: 10, username: 'teacher.e2e', employee_id: 'teacher.e2e', full_name: 'E2E Teacher', phone: null, phone_verified: 1, is_active: 1, failed_login_attempts: 0, locked_until: null, last_login_at: null, last_seen_at: null, is_online: 1 },
      { id: 11, username: 'locked.e2e', employee_id: 'locked.e2e', full_name: 'Locked Teacher', phone: null, phone_verified: 0, is_active: 1, failed_login_attempts: 5, locked_until: '2026-09-30 10:00:00', last_login_at: null, last_seen_at: null, is_online: 0 },
    ]
    subjects = [
      { id: 21, code: 'MATH', name_fr: 'Mathématiques', name_ar: 'الرياضيات', name_en: 'Mathematics', is_active: 1 },
      { id: 22, code: 'PHY', name_fr: 'Physique', name_ar: 'الفيزياء', name_en: 'Physics', is_active: 1 },
    ]
    teachings = []
    users = [
      { id: 10, school_id: 20, username: 'admin.e2e', employee_id: 'admin.e2e', full_name: 'E2E Admin', phone: null, phone_verified: 1, role: 'admin', account_status: 'active', is_active: 1, failed_login_attempts: 0, locked_until: null, last_login_at: null, last_seen_at: null, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-01T08:00:00Z' },
      { id: 11, school_id: 20, username: 'teacher.e2e', employee_id: 'teacher.e2e', full_name: 'E2E Teacher', phone: null, phone_verified: 1, role: 'teacher', account_status: 'active', is_active: 1, failed_login_attempts: 0, locked_until: null, last_login_at: null, last_seen_at: null, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-01T08:00:00Z' },
    ]
    academicYears = [
      { id: 1, school_id: 20, name: '2026/2027', starts_on: '2026-09-01', ends_on: '2027-07-31', is_active: 1, created_at: '2026-08-01T08:00:00Z' },
      { id: 2, school_id: 20, name: '2025/2026', starts_on: '2025-09-01', ends_on: '2026-07-31', is_active: 0, created_at: '2025-08-01T08:00:00Z' },
    ]
    onboarding = { id: 1, school_id: 20, full_name: 'New E2E Teacher', employee_id: 'new.teacher', phone: '+212600000000', status: 'pending', expires_at: '2026-10-01T00:00:00Z', reviewed_by: null, reviewed_at: null, rejection_reason: null, created_user_id: null, created_at: '2026-09-29T08:00:00Z', updated_at: '2026-09-29T08:00:00Z' }
    importStatus = 'validated'
    uploadContentType = null
    auditQuery = null
    studentsByClass = {
      1: [
        { id: 301, student_number: 'S301', massar_code: 'M301', birth_date: '2010-01-10', first_name: 'Amina', last_name: 'Student', status: 'active', created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-01T08:00:00Z' },
        { id: 302, student_number: 'S302', massar_code: 'M302', birth_date: '2010-02-11', first_name: 'Youssef', last_name: 'Student', status: 'active', created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-01T08:00:00Z' },
      ],
      2: [],
    }

    await page.route('**/api/v1/auth/session', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true,
        data: { authenticated: true, user: { id: 10, school_id: 20, employee_id: 'admin.e2e', full_name: 'E2E Admin', role, account_status: 'active' }, csrf: 'e2e-csrf-token' },
      }) })
    })

    await page.route('**/api/v1/admin/dashboard', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true,
        data: {
          date: '2026-09-29', absence_alert_threshold: 5,
          academic_year: { id: 1, name: '2026/2027', starts_on: '2026-09-01', ends_on: '2027-07-31' },
          summary: { active_classes: 2, active_students: 72, active_teachers: 2, online_teachers: 1, unverified_teachers: 1, locked_teachers: 1, today_records: 60, today_present: 52, today_absent: 5, today_late: 2, today_excused: 1, today_presence_rate: 86.67 },
          attendance_trend: [
            { date: '2026-09-26', record_count: 56, present_count: 48, absent_count: 5, late_count: 2, excused_count: 1, presence_rate: 85.71 },
            { date: '2026-09-27', record_count: 0, present_count: 0, absent_count: 0, late_count: 0, excused_count: 0, presence_rate: null },
            { date: '2026-09-28', record_count: 58, present_count: 50, absent_count: 4, late_count: 3, excused_count: 1, presence_rate: 86.21 },
            { date: '2026-09-29', record_count: 60, present_count: 52, absent_count: 5, late_count: 2, excused_count: 1, presence_rate: 86.67 },
          ],
          online_teachers: [{ id: 10, full_name: 'E2E Teacher', employee_id: 'teacher.e2e', last_seen_at: '2026-09-29T08:05:00Z' }],
          class_stats: [{ id: 1, name: 'E2E-2BAC-A', level: '2BAC', branch: 'SP', academic_year_id: 1, academic_year_name: '2026/2027', student_count: 40, today_records: 32, present_count: 29, absent_count: 2, late_count: 1, excused_count: 0 }],
          attention_students: [{ id: 301, first_name: 'Demo', last_name: 'Student', class_id: 1, class_name: 'E2E-2BAC-A', class_level: '2BAC', class_branch: 'SP', absent_count: 6, late_count: 1 }],
          classes_without_today_records: [{ id: 2, name: 'E2E-1BAC-B', level: '1BAC', branch: 'SVT', academic_year_name: '2026/2027' }],
          recent_audit: [{ id: 900, action: 'user.create', entity_type: 'user', entity_id: 11, created_at: '2026-09-29T08:00:00Z', full_name: 'E2E Admin', username: 'admin.e2e' }],
        },
      }) })
    })
    await page.route('**/api/v1/admin/classes', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { classes } }) })
        return
      }
      const payload = route.request().postDataJSON()
      if (payload.action === 'create') {
        const id = 3
        classes.push({ id, name: payload.name, level: payload.level ?? null, branch: payload.branch ?? null, academic_year_id: 1, is_active: 1, academic_year_name: '2026/2027', academic_year_active: 1 })
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id } }) })
        return
      }
      if (payload.action === 'update') {
        Object.assign(classes.find((item) => item.id === payload.id), { name: payload.name, level: payload.level ?? null, branch: payload.branch ?? null })
      }
      if (payload.action === 'activate' || payload.action === 'deactivate') {
        const item = classes.find((entry) => entry.id === payload.id)
        item.is_active = payload.action === 'activate' ? 1 : 0
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: payload.id ?? null, changed: true } }) })
    })
    await page.route('**/api/v1/admin/teachers', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { teachers, subjects, teachings, online_window_seconds: 300 } }) })
        return
      }
      const payload = route.request().postDataJSON()
      if (payload.action === 'assign') teachings.push({ id: 100 + teachings.length, teacher_id: payload.teacher_id, subject_id: payload.subject_id, subject_code: subjects.find((x) => x.id === payload.subject_id)?.code ?? '', subject_name_fr: 'Mathématiques', subject_name_ar: 'الرياضيات', subject_name_en: 'Mathematics', class_id: payload.class_id, class_name: classes.find((x) => x.id === payload.class_id)?.name ?? '', class_level: '2BAC', class_branch: 'SP', academic_year_id: 1, academic_year_name: '2026/2027', assigned_at: '2026-09-29T08:00:00Z' })
      if (payload.action === 'unassign') teachings = teachings.filter((x) => x.id !== payload.id)
      if (payload.action === 'create_subject') subjects.push({ id: 23, ...payload, is_active: 1 })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: payload.id ?? 23 } }) })
    })

    await page.route('**/api/v1/admin/users', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { users } }) })
        return
      }
      const payload = route.request().postDataJSON()
      const user = users.find((x) => x.id === payload.id)
      if (payload.action === 'set_status') { user.account_status = payload.status; user.is_active = payload.status === 'active' ? 1 : 0 }
      if (payload.action === 'reissue_sams_code') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { user_id: payload.id, sams_code: 'E2E-ONCE-CODE' } }) })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: payload.id ?? 12, session_version: 2 } }) })
    })
    await page.route('**/api/v1/admin/academic-years', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { academic_years: academicYears } }) })
        return
      }
      const payload = route.request().postDataJSON()
      if (payload.action === 'create') academicYears.push({ id: 3, school_id: 20, name: payload.name, starts_on: payload.starts_on, ends_on: payload.ends_on, is_active: payload.activate ? 1 : 0, created_at: '2026-09-29T08:00:00Z' })
      if (payload.action === 'activate') academicYears.forEach((x) => { x.is_active = x.id === payload.id ? 1 : 0 })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: payload.id ?? 3 } }) })
    })
    await page.route('**/api/v1/admin/onboarding/requests*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { requests: [onboarding] } }) })
    })
    await page.route('**/api/v1/admin/onboarding/code', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { school_id: 20, onboarding_code: 'E2E-NEW-CODE', expires_at: '2026-10-01T00:00:00Z' } }) })
    })
    await page.route('**/api/v1/admin/onboarding/1/review', async (route) => {
      const payload = route.request().postDataJSON()
      onboarding.status = payload.decision === 'approve' ? 'approved' : 'rejected'
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { request_id: 1, user_id: 12, reused: false, status: onboarding.status } }) })
    })

    await page.route('**/api/v1/imports/school', async (route) => {
      uploadContentType = route.request().headers()['content-type'] ?? null
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 55, status: 'validated' } }) })
    })
    await page.route('**/api/v1/imports/school/55*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true,
        data: {
          batch: { id: 55, created_by: 10, created_by_name: 'E2E Admin', target_academic_year_id: 1, target_academic_year_name: '2026/2027', source_academic_year: '2025/2026', original_filename: 'synthetic.md', file_sha256: 'abc', file_size: 100, status: importStatus, total_classes: 1, valid_classes: 1, warning_classes: 0, error_classes: 0, total_rows: 2, valid_rows: 2, warning_rows: 0, error_rows: 0, imported_at: importStatus === 'imported' ? '2026-09-29T08:10:00Z' : null, created_at: '2026-09-29T08:00:00Z', updated_at: '2026-09-29T08:00:00Z' },
          classes: [{ id: 501, batch_id: 55, source_sheet: 'Synthetic', source_block_start_row: 1, source_block_end_row: 3, source_class_name: 'E2E-2BAC-A', source_level: '2BAC', source_academic_year: '2025/2026', target_class_id: 1, status: importStatus === 'validated' ? 'staged' : 'mapped', student_count: 2, issues: [] }],
        },
      }) })
    })
    await page.route('**/api/v1/imports/school/55/reconcile', async (route) => {
      importStatus = 'reconciled'
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { batch_id: 55, ready_to_import: true, already_imported: false, summary: { mapped_classes: 1, conflict_rows: 0 } } }) })
    })
    await page.route('**/api/v1/imports/school/55/commit', async (route) => {
      importStatus = 'imported'
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { batch_id: 55, already_imported: false, summary: { student_count: 2, new_students: 0, existing_students: 2, enrollments_created: 0 } } }) })
    })
    await page.route('**/api/students.php*', async (route) => {
      const url = new URL(route.request().url())
      const classId = Number(url.searchParams.get('class_id') ?? 0)
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { students: studentsByClass[classId] ?? [] } }) })
        return
      }
      const payload = route.request().postDataJSON()
      const roster = studentsByClass[classId] ?? []
      if (payload.action === 'create') {
        const student = {
          id: 304,
          student_number: payload.student_number ?? null,
          massar_code: payload.massar_code ?? null,
          birth_date: payload.birth_date ?? null,
          first_name: payload.first_name,
          last_name: payload.last_name,
          status: 'active',
          created_at: '2026-09-29T08:00:00Z',
          updated_at: '2026-09-29T08:00:00Z',
        }
        roster.push(student)
        studentsByClass[classId] = roster
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: student.id } }) })
        return
      }
      const student = roster.find((item) => item.id === payload.id)
      if (payload.action === 'update' && student) Object.assign(student, payload, { id: student.id, status: student.status, updated_at: '2026-09-29T08:01:00Z' })
      if (payload.action === 'delete' && student) student.status = 'inactive'
      if (payload.action === 'transfer' && student) {
        studentsByClass[classId] = roster.filter((item) => item.id !== student.id)
        studentsByClass[payload.target_class_id] = [...(studentsByClass[payload.target_class_id] ?? []), student]
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: payload.id ?? null, changed: true, class_id: payload.target_class_id ?? classId, enrollment_id: 7, effective_date: payload.effective_date ?? null } }) })
    })

    await page.route('**/api/v1/admin/audit*', async (route) => {
      auditQuery = route.request().url()
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [{ id: 900, user_id: 10, username: 'admin.e2e', full_name: 'E2E Admin', action: 'user.create', entity_type: 'user', entity_id: 11, ip_address: '127.0.0.1', user_agent: 'Playwright', metadata: { source: 'e2e' }, created_at: '2026-09-29T08:00:00Z' }], total: 1, page: 1, per_page: 50, total_pages: 1 } }) })
    })
  })

  test('admin dashboard and class administration use the canonical APIs', async ({ page }) => {
    await page.goto('/app/admin/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText('72')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Attendance today' })).toBeVisible()
    await expect(page.getByText('E2E Teacher').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible()
    await page.goto('/app/admin/classes')
    await expect(page).toHaveURL(/\/app\/admin\/classes$/)
    await expect(page.getByRole('heading', { name: 'Classes' })).toBeVisible()
    await page.getByLabel('Class').fill('E2E-CREATED')
    await page.getByLabel('Level').fill('2BAC')
    await page.getByLabel('Branch').fill('SP')
    const create = page.waitForRequest((request) => request.url().endsWith('/api/v1/admin/classes') && request.method() === 'POST')
    await page.getByRole('button', { name: 'Save' }).click()
    const createRequest = await create
    expect(createRequest.postDataJSON()).toEqual(expect.objectContaining({ action: 'create', name: 'E2E-CREATED' }))
    await expect(page.getByText('E2E-CREATED')).toBeVisible()
  })

  test('admin students workspace manages roster lifecycle within class context', async ({ page }) => {
    await page.goto('/app/admin/students')
    await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible()
    await expect(page.getByLabel('Select class')).toHaveValue('1')
    await expect(page.getByText('Amina Student')).toBeVisible()

    await page.getByLabel('Search').fill('Amina')
    await expect(page.getByText('Amina Student')).toBeVisible()
    await expect(page.getByText('Youssef Student')).not.toBeVisible()

    await page.getByRole('row').filter({ hasText: 'Amina Student' }).getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByLabel('First name').fill('Amina Updated')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Amina Updated Student')).toBeVisible()

    await page.getByLabel('Search').fill('')
    await page.getByRole('button', { name: 'Transfer student' }).first().click()
    await page.getByLabel('Target class').selectOption('2')
    await page.getByLabel('Effective date').fill('2026-10-01')
    await page.getByRole('dialog').getByRole('button', { name: 'Transfer student', exact: true }).click()
    await expect(page.getByText('Amina Updated Student')).not.toBeVisible()

    await page.getByLabel('Select class').selectOption('2')
    await expect(page.getByText('Amina Updated Student')).toBeVisible()

    await page.getByLabel('Select class').selectOption('1')
    await page.getByLabel('Status').selectOption('all')
    await page.getByRole('button', { name: 'Deactivate' }).first().click()
    await expect(page.getByText('Youssef Student')).toBeVisible()
    await page.getByLabel('Status').selectOption('inactive')
    await expect(page.getByText('Youssef Student')).toBeVisible()
  })

  test('teachers, users, onboarding and academic years execute mutations and refresh server state', async ({ page }) => {
    await page.goto('/app/admin/teachers')
    await expect(page.getByRole('heading', { name: 'Teachers' })).toBeVisible()
    await page.getByRole('combobox', { name: 'Teacher', exact: true }).selectOption('10')
    await page.getByRole('combobox', { name: 'Subject', exact: true }).selectOption('21')
    await page.getByLabel('Class').selectOption('1')
    await page.getByRole('button', { name: 'Assign' }).click()
    await expect(page.getByRole('button', { name: 'Assign', exact: true })).toBeEnabled()
    await expect(page.getByText('E2E Teacher').last()).toBeVisible()
    await page.getByLabel('Subject code').fill('BIO')
    await page.getByLabel('Français').fill('Biologie')
    await page.getByLabel('العربية').fill('الأحياء')
    await page.getByLabel('English').fill('Biology')
    await page.getByRole('button', { name: 'Save' }).click()

    await page.goto('/app/admin/users')
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
    await page.getByRole('button', { name: 'Reissue SAMS Code' }).nth(1).click()
    await expect(page.getByText('E2E-ONCE-CODE')).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Suspend' }).nth(1).click()
    await expect(page.getByRole('row').filter({ hasText: 'teacher.e2e' }).getByText('suspended', { exact: true })).toBeVisible()

    await page.goto('/app/admin/onboarding')
    await expect(page.getByText('New E2E Teacher')).toBeVisible()
    await page.getByRole('button', { name: 'Rotate code' }).click()
    await expect(page.getByText('E2E-NEW-CODE')).toBeVisible()
    await page.getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByRole('cell', { name: 'approved' })).toBeVisible()

    await page.goto('/app/admin/academic-years')
    await page.getByLabel('Name').fill('2027/2028')
    await page.getByLabel('Starts on').fill('2027-09-01')
    await page.getByLabel('Ends on').fill('2028-07-31')
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText('2027/2028')).toBeVisible()
  })

  test('imports use multipart form data and preserve staged workflow boundaries', async ({ page }) => {
    await page.goto('/app/admin/imports')
    const input = page.getByLabel('Import file')
    await input.setInputFiles({ name: 'synthetic.md', mimeType: 'text/markdown', buffer: Buffer.from('SYNTHETIC FIXTURE ONLY') })
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect.poll(() => uploadContentType).toContain('multipart/form-data')
    await expect(page.getByRole('heading', { name: 'synthetic.md' })).toBeVisible()
    await page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Reconcile' }).click()
    await expect(page.getByText('reconciled', { exact: true })).toBeVisible()
    await page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Commit import' }).click()
    await expect(page.getByText('imported', { exact: true })).toBeVisible()
  })

  test('audit filters are sent to the server and Arabic admin stays RTL', async ({ page }) => {
    await page.goto('/app/admin/audit')
    await expect(page.getByRole('heading', { name: 'Audit' })).toBeVisible()
    await page.getByRole('combobox', { name: 'User' }).selectOption('11')
    await page.getByLabel('Action').fill('user.create')
    await page.getByRole('button', { name: 'Apply filters' }).click()
    await expect.poll(() => auditQuery).toContain('user_id=11')
    await expect.poll(() => auditQuery).toContain('action=user.create')
    const html = page.locator('html')
    await page.getByRole('combobox', { name: 'Language' }).selectOption('ar')
    await expect(html).toHaveAttribute('lang', 'ar')
    await expect(html).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { name: 'تدقيق' })).toBeVisible()
  })

  test('teacher role is denied from the admin route group', async ({ page }) => {
    role = 'teacher'
    await page.goto('/app/admin/dashboard')
    await expect(page).toHaveURL(/\/unauthorized$/)
  })
})
