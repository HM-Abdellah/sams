import { test, expect } from '@playwright/test';

const username = process.env.SAMS_E2E_USERNAME;
const password = process.env.SAMS_E2E_PASSWORD;
const teacherUsername = process.env.SAMS_E2E_TEACHER_USERNAME;
const teacherPassword = process.env.SAMS_E2E_TEACHER_PASSWORD;

test.describe('authenticated SAMS smoke', () => {
  async function login(page, user, pass) {
    await page.goto('login.php');
    await page.locator('#username').fill(user);
    await page.locator('#password').fill(pass);
    const loginResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth.php?action=login') &&
        response.request().method() === 'POST'
    );

    await page.locator('#loginBtn').click();

    const loginResponse = await loginResponsePromise;

    if (!loginResponse.ok()) {
      throw new Error(
        `Login API failed: HTTP ${loginResponse.status()}`
      );
    }

    await page.waitForURL(/index\.php$/);
  }

  test.skip(!username || !password, 'Set SAMS_E2E_USERNAME and SAMS_E2E_PASSWORD to run authenticated E2E tests.');

  test('login, operational roster and archive are reachable', async ({ page }) => {
    await login(page, username, password);
    await expect(page.locator('#classSelect')).toBeVisible();
    await expect(page.locator('#attendanceBody')).toBeVisible();

    const classCount = await page.locator('#classSelect option:not([disabled])').count();
    expect(classCount).toBeGreaterThan(0);

    await page.locator('.tab[data-tab="archive"]').click();
    await expect(page.locator('[data-panel="archive"]')).toBeVisible();
    await page.locator('#loadArchiveBtn').click();
    await expect(page.locator('#archiveTable')).toBeVisible();
    await expect(page.locator('[data-archive-day]').first()).toBeVisible();

    await page.locator('[data-archive-day]').first().click();
    await expect(page.locator('#archiveDayDialog')).toBeVisible();
    await page.locator('[data-close-dialog="archiveDayDialog"]').click();

    await page.locator('[data-archive-view="month"]').click();
    await expect(page.locator('[data-student-history]').first()).toBeVisible();
    await page.locator('[data-student-history]').first().click();
    await expect(page.locator('#studentHistoryDialog')).toBeVisible();
    await page.locator('[data-close-dialog="studentHistoryDialog"]').click();

    const adminTab = page.locator('.tab[data-tab="admin"]');
    if (await adminTab.count()) {
      await adminTab.click();
      await expect(page.locator('#userForm')).toBeVisible();
      await expect(page.locator('#assignmentForm')).toBeVisible();
      await expect(page.locator('#importForm')).toBeVisible();
    }
  });

  test('attendance edits are sent as one bulk request', async ({ page }) => {
    const batches = [];

    await page.route('**/api/attendance.php*', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      const body = route.request().postDataJSON();
      batches.push(body);

      const total = Array.isArray(body?.entries) ? body.entries.length : 0;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { changed: total, unchanged: 0, total }
        })
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, username, password);
    await expect(page.locator('#attendanceMobileList .attendance-student-card').first()).toBeVisible();
    await page.locator('#periods [data-select-period="1"]').click();
    const statusButtons = page.locator('#attendanceMobileList [data-attendance-toggle]');
    await expect(statusButtons).toHaveCount(3);
    await statusButtons.nth(0).click();
    await statusButtons.nth(1).click();
    await statusButtons.nth(2).click();

    await page.waitForTimeout(800);

    expect(batches).toHaveLength(1);
    expect(batches[0]?.action).toBe('bulk');
    expect(batches[0]?.entries).toHaveLength(3);
    expect(batches[0].entries.every((entry) => entry.action === 'upsert' && entry.status === 'absent')).toBe(true);
  });

  test('teacher cannot access historical archive and weekly sheet supports all three languages', async ({ page }) => {
    test.skip(!teacherUsername || !teacherPassword, 'Set teacher E2E credentials to run teacher isolation tests.');

    await login(page, teacherUsername, teacherPassword);

    await page.locator('.language-btn[data-lang="ar"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-i18n="weekly_attendance"]')).toHaveText('ورقة الحضور الأسبوعية');

    await page.locator('.language-btn[data-lang="en"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('[data-i18n="weekly_attendance"]')).toHaveText('Weekly attendance sheet');

    await page.locator('.language-btn[data-lang="fr"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('[data-i18n="weekly_attendance"]')).toHaveText('Feuille hebdomadaire de présence');
    await expect(page.locator('.tab[data-tab="archive"]')).toHaveCount(0);
  });

  test('teacher sees only assigned classes', async ({ page }) => {
    test.skip(!teacherUsername || !teacherPassword, 'Set teacher E2E credentials to run teacher isolation tests.');

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, teacherUsername, teacherPassword);
    await expect(page.locator('#attendanceMobileList')).toBeVisible();
    await expect(page.locator('#weekDays .week-day-btn')).toHaveCount(6);
    await expect(page.locator('#periods .period-btn')).toHaveCount(8);
    await expect(page.locator('#attendanceMobileList .attendance-student-card')).toHaveCount(3);
    await expect(page.locator('.tab[data-tab="admin"]')).toHaveCount(0);
    await expect(page.locator('.tab[data-tab="archive"]')).toHaveCount(0);
  });

  test('teacher can sign, reopen, correct and re-sign a lesson, then certify the week', async ({ page }) => {
    test.skip(!teacherUsername || !teacherPassword, 'Set teacher E2E credentials to run teacher isolation tests.');

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, teacherUsername, teacherPassword);

    const saturday = await page.locator('#weekDays .week-day-btn').nth(5).getAttribute('data-select-day');
    await page.locator('#weekDays [data-select-day="' + saturday + '"]').click();
    await page.locator('#periods [data-select-period="8"]').click();

    await expect(page.locator('#attendanceWorkflow [data-sign-period]')).toBeVisible();
    const firstMark = page.locator('#attendanceMobileList [data-attendance-toggle]').first();
    await firstMark.click();
    await expect(firstMark).toHaveText('X');

    await page.locator('#attendanceWorkflow [data-sign-period]').click();
    await expect(page.locator('#attendanceWorkflow .attendance-seal')).toContainText(/Validée par|Certified by|تمت المصادقة/);
    await expect(page.locator('#attendanceMobileList [data-attendance-toggle]').first()).toBeDisabled();

    await page.locator('#attendanceWorkflow [data-reopen-period]').click();
    await expect(page.locator('#attendanceWorkflow .attendance-seal')).toContainText(/Correction|re-sign|إعادة/);

    const reopenedMark = page.locator('#attendanceMobileList [data-attendance-toggle]').first();
    await reopenedMark.click();
    await expect(reopenedMark).toHaveText('');

    await page.locator('#attendanceWorkflow [data-sign-period]').click();
    await page.locator('#weeklyTeacherSignatures [data-sign-week]').click();
    await expect(page.locator('#weeklyTeacherSignatures .weekly-teacher-status.signed')).toHaveCount(1);
    await expect(page.locator('#weeklyTeacherSignatures')).toContainText('1/1');
  });

  test('teacher weekly attendance is touch-friendly and weekly print is populated', async ({ page }) => {
    test.skip(!teacherUsername || !teacherPassword, 'Set teacher E2E credentials to run teacher isolation tests.');

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, teacherUsername, teacherPassword);

    await expect(page.locator('#weekDays .week-day-btn')).toHaveCount(6);
    await expect(page.locator('#periods .period-btn')).toHaveCount(8);
    await expect(page.locator('#attendanceMobileList .attendance-student-card')).toHaveCount(3);

    await page.locator('.language-btn[data-lang="en"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.locator('.language-btn[data-lang="en"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.locator('#reportBtn').click();
    await expect(page.locator('#weeklyPrintSheet')).toContainText('Official weekly register');
    await expect(page.locator('#weeklyPrintSheet .print-attendance-table tbody tr')).toHaveCount(3);
  });

  test('admin can review and explicitly confirm a whole-school import', async ({ page }) => {
    await login(page, username, password);

    const batchId = 9001;
    let imported = false;

    const makeDetail = (status = 'validated', reconciled = false) => ({
      success: true,
      data: {
        batch: {
          id: batchId,
          created_by: 1,
          created_by_name: 'E2E Admin',
          target_academic_year_id: 1,
          target_academic_year_name: '2026/2027',
          source_academic_year: '2025/2026',
          original_filename: 'school-2025-2026.xlsx',
          file_sha256: 'a'.repeat(64),
          file_size: 4096,
          status: imported ? 'imported' : status,
          total_classes: 1,
          valid_classes: 1,
          warning_classes: 0,
          error_classes: 0,
          total_rows: 2,
          valid_rows: 2,
          warning_rows: 0,
          error_rows: 0,
        },
        classes: [{
          id: 9101,
          batch_id: batchId,
          source_sheet: 'TCSF',
          source_block_start_row: 8,
          source_block_end_row: 12,
          source_class_name: 'E2E-2BAC-A',
          source_level: '2BAC',
          source_academic_year: '2025/2026',
          target_class_id: 1,
          status: reconciled ? 'mapped' : 'valid',
          student_count: 2,
          issues: [],
        }],
        ...(reconciled ? {
          class: {
            id: 9101,
            batch_id: batchId,
            source_class_name: 'E2E-2BAC-A',
            target_class_id: 1,
            status: 'mapped',
            student_count: 2,
            issues: [],
          },
          rows: {
            rows: [
              {
                id: 9201,
                import_class_id: 9101,
                source_row: 9,
                roster_number: 1,
                first_name: 'Jean',
                last_name: 'Dupont',
                massar_code: 'E2E001',
                birth_date: '2010-05-12',
                status: 'matched',
                match_status: 'existing',
                issues: [],
              },
              {
                id: 9202,
                import_class_id: 9101,
                source_row: 10,
                roster_number: 2,
                first_name: 'New',
                last_name: 'Student',
                massar_code: 'E2ENEW01',
                birth_date: '2010-01-10',
                status: 'matched',
                match_status: 'new',
                issues: [],
              }
            ],
            total: 2,
            page: 1,
            per_page: 100,
            pages: 1,
          }
        } : {})
      }
    });

    await page.route('**/api/v1/imports/school', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            batch_id: batchId,
            status: 'validated',
            source_academic_year: '2025/2026',
            target_academic_year_id: 1,
            summary: {
              class_count: 1,
              valid_class_count: 1,
              warning_class_count: 0,
              error_class_count: 0,
              student_count: 2,
              valid_row_count: 2,
              warning_row_count: 0,
              error_row_count: 0
            },
            workbook_issues: [],
            classes: [{
              class_name: 'E2E-2BAC-A',
              level: '2BAC',
              academic_year: '2025/2026',
              source_sheet: 'TCSF',
              source_block_start_row: 8,
              source_block_end_row: 12,
              student_count: 2,
              status: 'valid',
              issues: []
            }]
          }
        })
      });
    });

    await page.route(new RegExp('/api/v1/imports/school/' + batchId + '(\\?.*)?
    await login(page, username, password);
    const classSelect = page.locator('#classSelect');
    await expect(classSelect).toHaveValue(/\d+/);

    await page.locator('.tab[data-tab="admin"]').click();
    await page.locator('#studentImportFile').setInputFiles('tests/fixtures/students-invalid.csv');
    await page.locator('#importForm button[type="submit"]').click();

    const importRow = page.locator('#importsTable tbody tr').filter({ hasText: 'students-invalid.csv' }).first();
    await expect(importRow).toBeVisible();

    await importRow.locator('[data-edit-import]').click();
    await expect(page.locator('#importCorrectionDialog')).toBeVisible();
    const birthDate = page.locator('#importCorrectionRows .import-correction-row input[name="birth_date"]').first();
    await expect(birthDate).toHaveValue('');
    await birthDate.fill('2010-03-15');
    await page.locator('#importCorrectionForm button[type="submit"]').click();
    await expect(page.locator('#importCorrectionDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    const validatedRow = page.locator('#importsTable tbody tr').filter({ hasText: 'students-invalid.csv' }).first();
    await expect(validatedRow).toContainText('validated');

    page.once('dialog', (dialog) => dialog.accept());
    await validatedRow.locator('[data-run-import]').click();

    await expect(page.locator('#studentCount')).toContainText('5');
  });

  test('admin can transfer a student without losing historical attendance', async ({ page }) => {
    await login(page, username, password);
    await page.locator('.tab[data-tab="students"]').click();

    const studentCard = page.locator('#studentsList .student-card').filter({ hasText: 'E2E001' }).first();
    await expect(studentCard).toBeVisible();
    await studentCard.locator('[data-transfer-student]').click();

    await expect(page.locator('#transferStudentDialog')).toBeVisible();
    await page.locator('#transferTargetClassInput').selectOption({ label: 'E2E-2BAC-B' });
    await page.locator('#transferEffectiveDateInput').fill('2026-10-01');
    await page.locator('#transferStudentForm button[type="submit"]').click();
    await expect(page.locator('#transferStudentDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    await expect(page.locator('#studentsList .student-card').filter({ hasText: 'E2E001' })).toHaveCount(0);

    await page.locator('#classSelect').selectOption({ label: 'E2E-2BAC-B' });
    await expect(page.locator('#studentsList .student-card').filter({ hasText: 'E2E001' })).toHaveCount(1);

    await page.locator('.tab[data-tab="archive"]').click();
    await page.locator('#loadArchiveBtn').click();
    const sourceClass = page.locator('#classSelect');
    await sourceClass.selectOption({ label: 'E2E-2BAC-A' });
    await page.locator('#loadArchiveBtn').click();

    const dayRow = page.locator('#archiveTable tbody tr').filter({ hasText: '2026-09-25' }).first();
    await expect(dayRow).toBeVisible();
    await dayRow.locator('[data-archive-day]').click();
    await expect(page.locator('#archiveDayDialog')).toContainText('E2E001');
  });

  test('admin can view teachers, subjects and teaching assignments', async ({ page }) => {
    await login(page, username, password);
    await page.locator('.tab[data-tab="teachers"]').click();

    await expect(page.locator('#teachersList .teacher-card').filter({ hasText: 'E2E Teacher' })).toBeVisible();
    const teacherCard = page.locator('#teachersList .teacher-card').filter({ hasText: 'E2E Teacher' }).first();
    await expect(teacherCard).toContainText('teacher.e2e');
    await expect(teacherCard).toContainText('Mathématiques');
    await expect(teacherCard).toContainText('E2E-2BAC-A');
    await expect(page.locator('#teacherTotal')).toHaveText('1');

    await page.locator('#assignTeachingBtn').click();
    await page.locator('#teachingTeacherId').selectOption({ label: 'E2E Teacher · teacher.e2e' });
    await page.locator('#teachingSubjectId').selectOption({ label: 'Mathématiques · MATH' });
    await page.locator('#teachingClassId').selectOption({ label: '2BAC · SP · E2E-2BAC-B · 2026/2027' });
    await page.locator('#teachingForm button[type="submit"]').click();
    await expect(page.locator('#teachingDialog')).toBeHidden();

    const teacherCardAfterAssignment = page.locator('#teachersList .teacher-card').filter({ hasText: 'E2E Teacher' }).first();
    await expect(teacherCardAfterAssignment.locator('.teaching-chip')).toHaveCount(2);
    await expect(teacherCardAfterAssignment).toContainText('E2E-2BAC-B');
  });

  test('admin dashboard separates school, branch and class statistics and supports languages', async ({ page }) => {
    await login(page, username, password);

    await page.locator('.language-btn[data-lang="ar"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-panel="teachers"] [data-i18n="teacher_management"]')).toHaveText('إدارة الأساتذة');

    await page.locator('.language-btn[data-lang="en"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('[data-panel="teachers"] [data-i18n="teacher_management"]')).toHaveText('Teacher management');

    await page.locator('.tab[data-tab="admin"]').click();
    await expect(page.locator('[data-i18n="school_dashboard"]')).toHaveText('School dashboard');
    await expect(page.locator('#dashboardPulse')).toContainText('School');
    const schoolMetric = page.locator('#dashboardPulse .dashboard-metric').first();
    await expect(schoolMetric).toContainText('School');
    await expect(schoolMetric.locator('div').first().locator('strong')).toHaveText('2');
    await expect(page.locator('#dashboardBranchGrid .branch-card')).toHaveCount(1);
    await expect(page.locator('#dashboardBranchGrid .branch-card').first()).toContainText('SP');
    const classRows = page.locator('#dashboardClassTable tbody tr');
    await expect(classRows).toHaveCount(2);
    await expect(page.locator('#dashboardClassTable')).toContainText('E2E-2BAC-A');
    await expect(page.locator('#dashboardClassTable')).toContainText('E2E-2BAC-B');

    await page.locator('.language-btn[data-lang="fr"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('admin can receive a fully signed weekly register', async ({ page }) => {
    test.skip(!teacherUsername || !teacherPassword, 'Set teacher E2E credentials to run weekly receipt isolation tests.');

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, teacherUsername, teacherPassword);
    await page.locator('#periods [data-select-period="1"]').click();
    await page.locator('#attendanceMobileList [data-attendance-toggle]').first().click();
    await page.locator('#attendanceWorkflow [data-sign-period]').click();
    await page.locator('#weeklyTeacherSignatures [data-sign-week]').click();
    await page.locator('#logoutBtn').click();
    await page.waitForURL(/login\.php$/);

    await login(page, username, password);
    await page.locator('#classSelect').selectOption({ label: 'E2E-2BAC-A' });
    await expect(page.locator('#weeklyTeacherSignatures')).toContainText('1/1');
    await expect(page.locator('#weeklyTeacherSignatures [data-receive-week]')).toBeVisible();

    await page.locator('.language-btn[data-lang="en"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.locator('#reportBtn').click();
    await expect(page.locator('#weeklyPrintSheet')).toContainText('Mathematics');

    await page.locator('#weeklyTeacherSignatures [data-receive-week]').click();
    await expect(page.locator('#weeklyTeacherSignatures .register-receipt.received')).toBeVisible();

    await page.reload();
    await expect(page.locator('#weeklyTeacherSignatures .register-receipt.received')).toBeVisible();
    await expect(page.locator('#weeklyTeacherSignatures [data-receive-week]')).toHaveCount(0);

    await page.locator('#logoutBtn').click();
    await page.waitForURL(/login\.php$/);

    await login(page, teacherUsername, teacherPassword);
    await page.locator('#periods [data-select-period="1"]').click();
    await page.locator('#attendanceWorkflow [data-reopen-period]').click();
    await expect(page.locator('#weeklyTeacherSignatures .register-receipt')).toHaveCount(0);
    await expect(page.locator('#weeklyTeacherSignatures .weekly-teacher-status.needs_resign')).toHaveCount(1);
  });

  test('admin can manage a class and a user through the UI', async ({ page }) => {
    await login(page, username, password);
    await page.locator('.tab[data-tab="admin"]').click();
    await expect(page.locator('#adminClassesTable')).toBeVisible();

    const className = 'E2E-UI-' + Date.now();
    await page.locator('#addClassBtn').click();
    await page.locator('#classNameInput').fill(className);
    await page.locator('#classLevelInput').fill('2BAC');
    await page.locator('#classBranchInput').fill('SP');
    const createClassResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/classes.php') &&
        response.request().method() === 'POST'
    );
    await page.locator('#classForm button[type="submit"]').click();
    await expect((await createClassResponse).ok()).toBeTruthy();
    await page.locator('.tab[data-tab="admin"]').click();
    const classRow = page.locator('#adminClassesTable tbody tr').filter({ hasText: className }).first();
    await expect(classRow).toBeVisible();

    await classRow.locator('[data-edit-class]').click();
    await page.locator('#editClassNameInput').fill(className + '-EDITED');
    await page.locator('#editClassForm button[type="submit"]').click();
    await expect(page.locator('#editClassDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    const editedClassRow = page.locator('#adminClassesTable tbody tr').filter({ hasText: className + '-EDITED' }).first();
    await expect(editedClassRow).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await editedClassRow.locator('[data-toggle-class]').click();
    await expect(editedClassRow.locator('td').nth(4)).toHaveText('Non');

    page.once('dialog', (dialog) => dialog.accept());
    await editedClassRow.locator('[data-toggle-class]').click();
    await expect(editedClassRow.locator('td').nth(4)).toHaveText('Oui');

    const createdUsername = 'e2e-ui-' + Date.now();
    const newPassword = 'e2e-ui-password-2026';

    await page.locator('#userUsernameInput').fill(createdUsername);
    await page.locator('#userFullNameInput').fill('E2E UI User');
    await page.locator('#userRoleInput').selectOption('teacher');
    await page.locator('#userPasswordInput').fill(newPassword);
    const createUserResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/users.php') &&
        response.request().method() === 'POST'
    );
    await page.locator('#userForm button[type="submit"]').click();
    await expect((await createUserResponse).ok()).toBeTruthy();

    await expect(page.locator('#usersTable tbody tr').filter({ hasText: createdUsername }).first()).toBeVisible();
    const userRow = page.locator('#usersTable tbody tr').filter({ hasText: createdUsername }).first();

    await userRow.locator('[data-edit-user]').click();
    await page.locator('#editUserFullNameInput').fill('E2E UI User Edited');
    await page.locator('#editUserForm button[type="submit"]').click();
    await expect(page.locator('#editUserDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    const editedUserRow = page.locator('#usersTable tbody tr').filter({ hasText: createdUsername }).first();
    await editedUserRow.locator('[data-reset-user]').click();
    await page.locator('#resetUserPasswordInput').fill('e2e-ui-password-reset-2026');
    await page.locator('#resetUserPasswordForm button[type="submit"]').click();
    await expect(page.locator('#resetUserPasswordDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    await editedUserRow.locator('[data-toggle-user]').click();
    await expect(editedUserRow.locator('td').nth(3)).toHaveText('Non');
  });

  test('logout invalidates the authenticated browser session', async ({ page }) => {
    await login(page, username, password);
    await page.locator('#logoutBtn').click();
    await page.waitForURL(/login\.php$/);

    await page.goto('index.php');
    await expect(page).toHaveURL(/login\.php$/);
  });
});
), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeDetail(imported ? 'imported' : 'validated', imported || true))
      });
    });

    await page.route(new RegExp('/api/v1/imports/school/' + batchId + '/reconcile
    await login(page, username, password);
    const classSelect = page.locator('#classSelect');
    await expect(classSelect).toHaveValue(/\d+/);

    await page.locator('.tab[data-tab="admin"]').click();
    await page.locator('#studentImportFile').setInputFiles('tests/fixtures/students-invalid.csv');
    await page.locator('#importForm button[type="submit"]').click();

    const importRow = page.locator('#importsTable tbody tr').filter({ hasText: 'students-invalid.csv' }).first();
    await expect(importRow).toBeVisible();

    await importRow.locator('[data-edit-import]').click();
    await expect(page.locator('#importCorrectionDialog')).toBeVisible();
    const birthDate = page.locator('#importCorrectionRows .import-correction-row input[name="birth_date"]').first();
    await expect(birthDate).toHaveValue('');
    await birthDate.fill('2010-03-15');
    await page.locator('#importCorrectionForm button[type="submit"]').click();
    await expect(page.locator('#importCorrectionDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    const validatedRow = page.locator('#importsTable tbody tr').filter({ hasText: 'students-invalid.csv' }).first();
    await expect(validatedRow).toContainText('validated');

    page.once('dialog', (dialog) => dialog.accept());
    await validatedRow.locator('[data-run-import]').click();

    await expect(page.locator('#studentCount')).toContainText('5');
  });

  test('admin can transfer a student without losing historical attendance', async ({ page }) => {
    await login(page, username, password);
    await page.locator('.tab[data-tab="students"]').click();

    const studentCard = page.locator('#studentsList .student-card').filter({ hasText: 'E2E001' }).first();
    await expect(studentCard).toBeVisible();
    await studentCard.locator('[data-transfer-student]').click();

    await expect(page.locator('#transferStudentDialog')).toBeVisible();
    await page.locator('#transferTargetClassInput').selectOption({ label: 'E2E-2BAC-B' });
    await page.locator('#transferEffectiveDateInput').fill('2026-10-01');
    await page.locator('#transferStudentForm button[type="submit"]').click();
    await expect(page.locator('#transferStudentDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    await expect(page.locator('#studentsList .student-card').filter({ hasText: 'E2E001' })).toHaveCount(0);

    await page.locator('#classSelect').selectOption({ label: 'E2E-2BAC-B' });
    await expect(page.locator('#studentsList .student-card').filter({ hasText: 'E2E001' })).toHaveCount(1);

    await page.locator('.tab[data-tab="archive"]').click();
    await page.locator('#loadArchiveBtn').click();
    const sourceClass = page.locator('#classSelect');
    await sourceClass.selectOption({ label: 'E2E-2BAC-A' });
    await page.locator('#loadArchiveBtn').click();

    const dayRow = page.locator('#archiveTable tbody tr').filter({ hasText: '2026-09-25' }).first();
    await expect(dayRow).toBeVisible();
    await dayRow.locator('[data-archive-day]').click();
    await expect(page.locator('#archiveDayDialog')).toContainText('E2E001');
  });

  test('admin can view teachers, subjects and teaching assignments', async ({ page }) => {
    await login(page, username, password);
    await page.locator('.tab[data-tab="teachers"]').click();

    await expect(page.locator('#teachersList .teacher-card').filter({ hasText: 'E2E Teacher' })).toBeVisible();
    const teacherCard = page.locator('#teachersList .teacher-card').filter({ hasText: 'E2E Teacher' }).first();
    await expect(teacherCard).toContainText('teacher.e2e');
    await expect(teacherCard).toContainText('Mathématiques');
    await expect(teacherCard).toContainText('E2E-2BAC-A');
    await expect(page.locator('#teacherTotal')).toHaveText('1');

    await page.locator('#assignTeachingBtn').click();
    await page.locator('#teachingTeacherId').selectOption({ label: 'E2E Teacher · teacher.e2e' });
    await page.locator('#teachingSubjectId').selectOption({ label: 'Mathématiques · MATH' });
    await page.locator('#teachingClassId').selectOption({ label: '2BAC · SP · E2E-2BAC-B · 2026/2027' });
    await page.locator('#teachingForm button[type="submit"]').click();
    await expect(page.locator('#teachingDialog')).toBeHidden();

    const teacherCardAfterAssignment = page.locator('#teachersList .teacher-card').filter({ hasText: 'E2E Teacher' }).first();
    await expect(teacherCardAfterAssignment.locator('.teaching-chip')).toHaveCount(2);
    await expect(teacherCardAfterAssignment).toContainText('E2E-2BAC-B');
  });

  test('admin dashboard separates school, branch and class statistics and supports languages', async ({ page }) => {
    await login(page, username, password);

    await page.locator('.language-btn[data-lang="ar"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-panel="teachers"] [data-i18n="teacher_management"]')).toHaveText('إدارة الأساتذة');

    await page.locator('.language-btn[data-lang="en"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('[data-panel="teachers"] [data-i18n="teacher_management"]')).toHaveText('Teacher management');

    await page.locator('.tab[data-tab="admin"]').click();
    await expect(page.locator('[data-i18n="school_dashboard"]')).toHaveText('School dashboard');
    await expect(page.locator('#dashboardPulse')).toContainText('School');
    const schoolMetric = page.locator('#dashboardPulse .dashboard-metric').first();
    await expect(schoolMetric).toContainText('School');
    await expect(schoolMetric.locator('div').first().locator('strong')).toHaveText('2');
    await expect(page.locator('#dashboardBranchGrid .branch-card')).toHaveCount(1);
    await expect(page.locator('#dashboardBranchGrid .branch-card').first()).toContainText('SP');
    const classRows = page.locator('#dashboardClassTable tbody tr');
    await expect(classRows).toHaveCount(2);
    await expect(page.locator('#dashboardClassTable')).toContainText('E2E-2BAC-A');
    await expect(page.locator('#dashboardClassTable')).toContainText('E2E-2BAC-B');

    await page.locator('.language-btn[data-lang="fr"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('admin can receive a fully signed weekly register', async ({ page }) => {
    test.skip(!teacherUsername || !teacherPassword, 'Set teacher E2E credentials to run weekly receipt isolation tests.');

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, teacherUsername, teacherPassword);
    await page.locator('#periods [data-select-period="1"]').click();
    await page.locator('#attendanceMobileList [data-attendance-toggle]').first().click();
    await page.locator('#attendanceWorkflow [data-sign-period]').click();
    await page.locator('#weeklyTeacherSignatures [data-sign-week]').click();
    await page.locator('#logoutBtn').click();
    await page.waitForURL(/login\.php$/);

    await login(page, username, password);
    await page.locator('#classSelect').selectOption({ label: 'E2E-2BAC-A' });
    await expect(page.locator('#weeklyTeacherSignatures')).toContainText('1/1');
    await expect(page.locator('#weeklyTeacherSignatures [data-receive-week]')).toBeVisible();

    await page.locator('.language-btn[data-lang="en"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.locator('#reportBtn').click();
    await expect(page.locator('#weeklyPrintSheet')).toContainText('Mathematics');

    await page.locator('#weeklyTeacherSignatures [data-receive-week]').click();
    await expect(page.locator('#weeklyTeacherSignatures .register-receipt.received')).toBeVisible();

    await page.reload();
    await expect(page.locator('#weeklyTeacherSignatures .register-receipt.received')).toBeVisible();
    await expect(page.locator('#weeklyTeacherSignatures [data-receive-week]')).toHaveCount(0);

    await page.locator('#logoutBtn').click();
    await page.waitForURL(/login\.php$/);

    await login(page, teacherUsername, teacherPassword);
    await page.locator('#periods [data-select-period="1"]').click();
    await page.locator('#attendanceWorkflow [data-reopen-period]').click();
    await expect(page.locator('#weeklyTeacherSignatures .register-receipt')).toHaveCount(0);
    await expect(page.locator('#weeklyTeacherSignatures .weekly-teacher-status.needs_resign')).toHaveCount(1);
  });

  test('admin can manage a class and a user through the UI', async ({ page }) => {
    await login(page, username, password);
    await page.locator('.tab[data-tab="admin"]').click();
    await expect(page.locator('#adminClassesTable')).toBeVisible();

    const className = 'E2E-UI-' + Date.now();
    await page.locator('#addClassBtn').click();
    await page.locator('#classNameInput').fill(className);
    await page.locator('#classLevelInput').fill('2BAC');
    await page.locator('#classBranchInput').fill('SP');
    const createClassResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/classes.php') &&
        response.request().method() === 'POST'
    );
    await page.locator('#classForm button[type="submit"]').click();
    await expect((await createClassResponse).ok()).toBeTruthy();
    await page.locator('.tab[data-tab="admin"]').click();
    const classRow = page.locator('#adminClassesTable tbody tr').filter({ hasText: className }).first();
    await expect(classRow).toBeVisible();

    await classRow.locator('[data-edit-class]').click();
    await page.locator('#editClassNameInput').fill(className + '-EDITED');
    await page.locator('#editClassForm button[type="submit"]').click();
    await expect(page.locator('#editClassDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    const editedClassRow = page.locator('#adminClassesTable tbody tr').filter({ hasText: className + '-EDITED' }).first();
    await expect(editedClassRow).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await editedClassRow.locator('[data-toggle-class]').click();
    await expect(editedClassRow.locator('td').nth(4)).toHaveText('Non');

    page.once('dialog', (dialog) => dialog.accept());
    await editedClassRow.locator('[data-toggle-class]').click();
    await expect(editedClassRow.locator('td').nth(4)).toHaveText('Oui');

    const createdUsername = 'e2e-ui-' + Date.now();
    const newPassword = 'e2e-ui-password-2026';

    await page.locator('#userUsernameInput').fill(createdUsername);
    await page.locator('#userFullNameInput').fill('E2E UI User');
    await page.locator('#userRoleInput').selectOption('teacher');
    await page.locator('#userPasswordInput').fill(newPassword);
    const createUserResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/users.php') &&
        response.request().method() === 'POST'
    );
    await page.locator('#userForm button[type="submit"]').click();
    await expect((await createUserResponse).ok()).toBeTruthy();

    await expect(page.locator('#usersTable tbody tr').filter({ hasText: createdUsername }).first()).toBeVisible();
    const userRow = page.locator('#usersTable tbody tr').filter({ hasText: createdUsername }).first();

    await userRow.locator('[data-edit-user]').click();
    await page.locator('#editUserFullNameInput').fill('E2E UI User Edited');
    await page.locator('#editUserForm button[type="submit"]').click();
    await expect(page.locator('#editUserDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    const editedUserRow = page.locator('#usersTable tbody tr').filter({ hasText: createdUsername }).first();
    await editedUserRow.locator('[data-reset-user]').click();
    await page.locator('#resetUserPasswordInput').fill('e2e-ui-password-reset-2026');
    await page.locator('#resetUserPasswordForm button[type="submit"]').click();
    await expect(page.locator('#resetUserPasswordDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    await editedUserRow.locator('[data-toggle-user]').click();
    await expect(editedUserRow.locator('td').nth(3)).toHaveText('Non');
  });

  test('logout invalidates the authenticated browser session', async ({ page }) => {
    await login(page, username, password);
    await page.locator('#logoutBtn').click();
    await page.waitForURL(/login\.php$/);

    await page.goto('index.php');
    await expect(page).toHaveURL(/login\.php$/);
  });
});
), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            batch_id: batchId,
            ready_to_import: true,
            already_imported: false,
            summary: {
              ready_to_import: true,
              target_academic_year_id: 1,
              class_count: 1,
              mapped_classes: 1,
              class_conflicts: 0,
              new_students: 1,
              existing_students: 1,
              conflict_rows: 0
            }
          }
        })
      });
    });

    await page.route(new RegExp('/api/v1/imports/school/' + batchId + '/commit
    await login(page, username, password);
    const classSelect = page.locator('#classSelect');
    await expect(classSelect).toHaveValue(/\d+/);

    await page.locator('.tab[data-tab="admin"]').click();
    await page.locator('#studentImportFile').setInputFiles('tests/fixtures/students-invalid.csv');
    await page.locator('#importForm button[type="submit"]').click();

    const importRow = page.locator('#importsTable tbody tr').filter({ hasText: 'students-invalid.csv' }).first();
    await expect(importRow).toBeVisible();

    await importRow.locator('[data-edit-import]').click();
    await expect(page.locator('#importCorrectionDialog')).toBeVisible();
    const birthDate = page.locator('#importCorrectionRows .import-correction-row input[name="birth_date"]').first();
    await expect(birthDate).toHaveValue('');
    await birthDate.fill('2010-03-15');
    await page.locator('#importCorrectionForm button[type="submit"]').click();
    await expect(page.locator('#importCorrectionDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    const validatedRow = page.locator('#importsTable tbody tr').filter({ hasText: 'students-invalid.csv' }).first();
    await expect(validatedRow).toContainText('validated');

    page.once('dialog', (dialog) => dialog.accept());
    await validatedRow.locator('[data-run-import]').click();

    await expect(page.locator('#studentCount')).toContainText('5');
  });

  test('admin can transfer a student without losing historical attendance', async ({ page }) => {
    await login(page, username, password);
    await page.locator('.tab[data-tab="students"]').click();

    const studentCard = page.locator('#studentsList .student-card').filter({ hasText: 'E2E001' }).first();
    await expect(studentCard).toBeVisible();
    await studentCard.locator('[data-transfer-student]').click();

    await expect(page.locator('#transferStudentDialog')).toBeVisible();
    await page.locator('#transferTargetClassInput').selectOption({ label: 'E2E-2BAC-B' });
    await page.locator('#transferEffectiveDateInput').fill('2026-10-01');
    await page.locator('#transferStudentForm button[type="submit"]').click();
    await expect(page.locator('#transferStudentDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    await expect(page.locator('#studentsList .student-card').filter({ hasText: 'E2E001' })).toHaveCount(0);

    await page.locator('#classSelect').selectOption({ label: 'E2E-2BAC-B' });
    await expect(page.locator('#studentsList .student-card').filter({ hasText: 'E2E001' })).toHaveCount(1);

    await page.locator('.tab[data-tab="archive"]').click();
    await page.locator('#loadArchiveBtn').click();
    const sourceClass = page.locator('#classSelect');
    await sourceClass.selectOption({ label: 'E2E-2BAC-A' });
    await page.locator('#loadArchiveBtn').click();

    const dayRow = page.locator('#archiveTable tbody tr').filter({ hasText: '2026-09-25' }).first();
    await expect(dayRow).toBeVisible();
    await dayRow.locator('[data-archive-day]').click();
    await expect(page.locator('#archiveDayDialog')).toContainText('E2E001');
  });

  test('admin can view teachers, subjects and teaching assignments', async ({ page }) => {
    await login(page, username, password);
    await page.locator('.tab[data-tab="teachers"]').click();

    await expect(page.locator('#teachersList .teacher-card').filter({ hasText: 'E2E Teacher' })).toBeVisible();
    const teacherCard = page.locator('#teachersList .teacher-card').filter({ hasText: 'E2E Teacher' }).first();
    await expect(teacherCard).toContainText('teacher.e2e');
    await expect(teacherCard).toContainText('Mathématiques');
    await expect(teacherCard).toContainText('E2E-2BAC-A');
    await expect(page.locator('#teacherTotal')).toHaveText('1');

    await page.locator('#assignTeachingBtn').click();
    await page.locator('#teachingTeacherId').selectOption({ label: 'E2E Teacher · teacher.e2e' });
    await page.locator('#teachingSubjectId').selectOption({ label: 'Mathématiques · MATH' });
    await page.locator('#teachingClassId').selectOption({ label: '2BAC · SP · E2E-2BAC-B · 2026/2027' });
    await page.locator('#teachingForm button[type="submit"]').click();
    await expect(page.locator('#teachingDialog')).toBeHidden();

    const teacherCardAfterAssignment = page.locator('#teachersList .teacher-card').filter({ hasText: 'E2E Teacher' }).first();
    await expect(teacherCardAfterAssignment.locator('.teaching-chip')).toHaveCount(2);
    await expect(teacherCardAfterAssignment).toContainText('E2E-2BAC-B');
  });

  test('admin dashboard separates school, branch and class statistics and supports languages', async ({ page }) => {
    await login(page, username, password);

    await page.locator('.language-btn[data-lang="ar"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-panel="teachers"] [data-i18n="teacher_management"]')).toHaveText('إدارة الأساتذة');

    await page.locator('.language-btn[data-lang="en"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('[data-panel="teachers"] [data-i18n="teacher_management"]')).toHaveText('Teacher management');

    await page.locator('.tab[data-tab="admin"]').click();
    await expect(page.locator('[data-i18n="school_dashboard"]')).toHaveText('School dashboard');
    await expect(page.locator('#dashboardPulse')).toContainText('School');
    const schoolMetric = page.locator('#dashboardPulse .dashboard-metric').first();
    await expect(schoolMetric).toContainText('School');
    await expect(schoolMetric.locator('div').first().locator('strong')).toHaveText('2');
    await expect(page.locator('#dashboardBranchGrid .branch-card')).toHaveCount(1);
    await expect(page.locator('#dashboardBranchGrid .branch-card').first()).toContainText('SP');
    const classRows = page.locator('#dashboardClassTable tbody tr');
    await expect(classRows).toHaveCount(2);
    await expect(page.locator('#dashboardClassTable')).toContainText('E2E-2BAC-A');
    await expect(page.locator('#dashboardClassTable')).toContainText('E2E-2BAC-B');

    await page.locator('.language-btn[data-lang="fr"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('admin can receive a fully signed weekly register', async ({ page }) => {
    test.skip(!teacherUsername || !teacherPassword, 'Set teacher E2E credentials to run weekly receipt isolation tests.');

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, teacherUsername, teacherPassword);
    await page.locator('#periods [data-select-period="1"]').click();
    await page.locator('#attendanceMobileList [data-attendance-toggle]').first().click();
    await page.locator('#attendanceWorkflow [data-sign-period]').click();
    await page.locator('#weeklyTeacherSignatures [data-sign-week]').click();
    await page.locator('#logoutBtn').click();
    await page.waitForURL(/login\.php$/);

    await login(page, username, password);
    await page.locator('#classSelect').selectOption({ label: 'E2E-2BAC-A' });
    await expect(page.locator('#weeklyTeacherSignatures')).toContainText('1/1');
    await expect(page.locator('#weeklyTeacherSignatures [data-receive-week]')).toBeVisible();

    await page.locator('.language-btn[data-lang="en"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.locator('#reportBtn').click();
    await expect(page.locator('#weeklyPrintSheet')).toContainText('Mathematics');

    await page.locator('#weeklyTeacherSignatures [data-receive-week]').click();
    await expect(page.locator('#weeklyTeacherSignatures .register-receipt.received')).toBeVisible();

    await page.reload();
    await expect(page.locator('#weeklyTeacherSignatures .register-receipt.received')).toBeVisible();
    await expect(page.locator('#weeklyTeacherSignatures [data-receive-week]')).toHaveCount(0);

    await page.locator('#logoutBtn').click();
    await page.waitForURL(/login\.php$/);

    await login(page, teacherUsername, teacherPassword);
    await page.locator('#periods [data-select-period="1"]').click();
    await page.locator('#attendanceWorkflow [data-reopen-period]').click();
    await expect(page.locator('#weeklyTeacherSignatures .register-receipt')).toHaveCount(0);
    await expect(page.locator('#weeklyTeacherSignatures .weekly-teacher-status.needs_resign')).toHaveCount(1);
  });

  test('admin can manage a class and a user through the UI', async ({ page }) => {
    await login(page, username, password);
    await page.locator('.tab[data-tab="admin"]').click();
    await expect(page.locator('#adminClassesTable')).toBeVisible();

    const className = 'E2E-UI-' + Date.now();
    await page.locator('#addClassBtn').click();
    await page.locator('#classNameInput').fill(className);
    await page.locator('#classLevelInput').fill('2BAC');
    await page.locator('#classBranchInput').fill('SP');
    const createClassResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/classes.php') &&
        response.request().method() === 'POST'
    );
    await page.locator('#classForm button[type="submit"]').click();
    await expect((await createClassResponse).ok()).toBeTruthy();
    await page.locator('.tab[data-tab="admin"]').click();
    const classRow = page.locator('#adminClassesTable tbody tr').filter({ hasText: className }).first();
    await expect(classRow).toBeVisible();

    await classRow.locator('[data-edit-class]').click();
    await page.locator('#editClassNameInput').fill(className + '-EDITED');
    await page.locator('#editClassForm button[type="submit"]').click();
    await expect(page.locator('#editClassDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    const editedClassRow = page.locator('#adminClassesTable tbody tr').filter({ hasText: className + '-EDITED' }).first();
    await expect(editedClassRow).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await editedClassRow.locator('[data-toggle-class]').click();
    await expect(editedClassRow.locator('td').nth(4)).toHaveText('Non');

    page.once('dialog', (dialog) => dialog.accept());
    await editedClassRow.locator('[data-toggle-class]').click();
    await expect(editedClassRow.locator('td').nth(4)).toHaveText('Oui');

    const createdUsername = 'e2e-ui-' + Date.now();
    const newPassword = 'e2e-ui-password-2026';

    await page.locator('#userUsernameInput').fill(createdUsername);
    await page.locator('#userFullNameInput').fill('E2E UI User');
    await page.locator('#userRoleInput').selectOption('teacher');
    await page.locator('#userPasswordInput').fill(newPassword);
    const createUserResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/users.php') &&
        response.request().method() === 'POST'
    );
    await page.locator('#userForm button[type="submit"]').click();
    await expect((await createUserResponse).ok()).toBeTruthy();

    await expect(page.locator('#usersTable tbody tr').filter({ hasText: createdUsername }).first()).toBeVisible();
    const userRow = page.locator('#usersTable tbody tr').filter({ hasText: createdUsername }).first();

    await userRow.locator('[data-edit-user]').click();
    await page.locator('#editUserFullNameInput').fill('E2E UI User Edited');
    await page.locator('#editUserForm button[type="submit"]').click();
    await expect(page.locator('#editUserDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    const editedUserRow = page.locator('#usersTable tbody tr').filter({ hasText: createdUsername }).first();
    await editedUserRow.locator('[data-reset-user]').click();
    await page.locator('#resetUserPasswordInput').fill('e2e-ui-password-reset-2026');
    await page.locator('#resetUserPasswordForm button[type="submit"]').click();
    await expect(page.locator('#resetUserPasswordDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    await editedUserRow.locator('[data-toggle-user]').click();
    await expect(editedUserRow.locator('td').nth(3)).toHaveText('Non');
  });

  test('logout invalidates the authenticated browser session', async ({ page }) => {
    await login(page, username, password);
    await page.locator('#logoutBtn').click();
    await page.waitForURL(/login\.php$/);

    await page.goto('index.php');
    await expect(page).toHaveURL(/login\.php$/);
  });
});
), async (route) => {
      imported = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            batch_id: batchId,
            already_imported: false,
            summary: {
              student_count: 2,
              new_students: 1,
              existing_students: 1,
              enrollments_created: 1
            }
          }
        })
      });
    });

    await page.locator('.tab[data-tab="admin"]').click();
    await expect(page.locator('#schoolImportForm')).toBeVisible();
    await page.locator('.language-btn[data-lang="en"]').click();
    const targetYearOption = page.locator('#schoolImportAcademicYearInput option').filter({ hasText: '2026/2027' }).first();
    const targetYearId = await targetYearOption.getAttribute('value');
    expect(targetYearId).toBeTruthy();
    await page.locator('#schoolImportAcademicYearInput').selectOption({ value: targetYearId });
    await page.locator('#schoolImportFile').setInputFiles({
      name: 'school-2025-2026.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('synthetic-e2e-workbook')
    });
    await page.locator('#schoolImportUploadBtn').click();

    await expect(page.locator('#schoolImportReview')).toContainText('school-2025-2026.xlsx');
    await expect(page.locator('#schoolImportReview')).toContainText('E2E-2BAC-A');
    await expect(page.locator('#schoolImportCommitBtn')).toBeDisabled();

    await page.locator('[data-school-import-class="9101"]').click();
    await expect(page.locator('#schoolImportRowsReview')).toContainText('E2E001');
    await expect(page.locator('#schoolImportRowsReview')).toContainText('existing');
    await expect(page.locator('#schoolImportRowsReview')).toContainText('new');

    await page.locator('#schoolImportReconcileBtn').click();
    await expect(page.locator('#schoolImportReview')).toContainText('Ready for final import');
    await expect(page.locator('#schoolImportCommitBtn')).toBeEnabled();

    await page.locator('#schoolImportCommitBtn').click();
    await expect(page.locator('#schoolImportCommitDialog')).toBeVisible();
    await expect(page.locator('#schoolImportCommitConfirmBtn')).toBeDisabled();

    await page.locator('#schoolImportReviewedInput').check();
    await expect(page.locator('#schoolImportCommitConfirmBtn')).toBeEnabled();
    await page.locator('#schoolImportCommitConfirmBtn').click();

    await expect(page.locator('#schoolImportCommitDialog')).toBeHidden();
    await expect(page.locator('#schoolImportReview')).toContainText('Imported');
    await expect(page.locator('#schoolImportCommitBtn')).toBeDisabled();
  });

  test('admin can complete a CSV import after correcting staged data', async ({ page }) => {
    await login(page, username, password);
    const classSelect = page.locator('#classSelect');
    await expect(classSelect).toHaveValue(/\d+/);

    await page.locator('.tab[data-tab="admin"]').click();
    await page.locator('#studentImportFile').setInputFiles('tests/fixtures/students-invalid.csv');
    await page.locator('#importForm button[type="submit"]').click();

    const importRow = page.locator('#importsTable tbody tr').filter({ hasText: 'students-invalid.csv' }).first();
    await expect(importRow).toBeVisible();

    await importRow.locator('[data-edit-import]').click();
    await expect(page.locator('#importCorrectionDialog')).toBeVisible();
    const birthDate = page.locator('#importCorrectionRows .import-correction-row input[name="birth_date"]').first();
    await expect(birthDate).toHaveValue('');
    await birthDate.fill('2010-03-15');
    await page.locator('#importCorrectionForm button[type="submit"]').click();
    await expect(page.locator('#importCorrectionDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    const validatedRow = page.locator('#importsTable tbody tr').filter({ hasText: 'students-invalid.csv' }).first();
    await expect(validatedRow).toContainText('validated');

    page.once('dialog', (dialog) => dialog.accept());
    await validatedRow.locator('[data-run-import]').click();

    await expect(page.locator('#studentCount')).toContainText('5');
  });

  test('admin can transfer a student without losing historical attendance', async ({ page }) => {
    await login(page, username, password);
    await page.locator('.tab[data-tab="students"]').click();

    const studentCard = page.locator('#studentsList .student-card').filter({ hasText: 'E2E001' }).first();
    await expect(studentCard).toBeVisible();
    await studentCard.locator('[data-transfer-student]').click();

    await expect(page.locator('#transferStudentDialog')).toBeVisible();
    await page.locator('#transferTargetClassInput').selectOption({ label: 'E2E-2BAC-B' });
    await page.locator('#transferEffectiveDateInput').fill('2026-10-01');
    await page.locator('#transferStudentForm button[type="submit"]').click();
    await expect(page.locator('#transferStudentDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    await expect(page.locator('#studentsList .student-card').filter({ hasText: 'E2E001' })).toHaveCount(0);

    await page.locator('#classSelect').selectOption({ label: 'E2E-2BAC-B' });
    await expect(page.locator('#studentsList .student-card').filter({ hasText: 'E2E001' })).toHaveCount(1);

    await page.locator('.tab[data-tab="archive"]').click();
    await page.locator('#loadArchiveBtn').click();
    const sourceClass = page.locator('#classSelect');
    await sourceClass.selectOption({ label: 'E2E-2BAC-A' });
    await page.locator('#loadArchiveBtn').click();

    const dayRow = page.locator('#archiveTable tbody tr').filter({ hasText: '2026-09-25' }).first();
    await expect(dayRow).toBeVisible();
    await dayRow.locator('[data-archive-day]').click();
    await expect(page.locator('#archiveDayDialog')).toContainText('E2E001');
  });

  test('admin can view teachers, subjects and teaching assignments', async ({ page }) => {
    await login(page, username, password);
    await page.locator('.tab[data-tab="teachers"]').click();

    await expect(page.locator('#teachersList .teacher-card').filter({ hasText: 'E2E Teacher' })).toBeVisible();
    const teacherCard = page.locator('#teachersList .teacher-card').filter({ hasText: 'E2E Teacher' }).first();
    await expect(teacherCard).toContainText('teacher.e2e');
    await expect(teacherCard).toContainText('Mathématiques');
    await expect(teacherCard).toContainText('E2E-2BAC-A');
    await expect(page.locator('#teacherTotal')).toHaveText('1');

    await page.locator('#assignTeachingBtn').click();
    await page.locator('#teachingTeacherId').selectOption({ label: 'E2E Teacher · teacher.e2e' });
    await page.locator('#teachingSubjectId').selectOption({ label: 'Mathématiques · MATH' });
    await page.locator('#teachingClassId').selectOption({ label: '2BAC · SP · E2E-2BAC-B · 2026/2027' });
    await page.locator('#teachingForm button[type="submit"]').click();
    await expect(page.locator('#teachingDialog')).toBeHidden();

    const teacherCardAfterAssignment = page.locator('#teachersList .teacher-card').filter({ hasText: 'E2E Teacher' }).first();
    await expect(teacherCardAfterAssignment.locator('.teaching-chip')).toHaveCount(2);
    await expect(teacherCardAfterAssignment).toContainText('E2E-2BAC-B');
  });

  test('admin dashboard separates school, branch and class statistics and supports languages', async ({ page }) => {
    await login(page, username, password);

    await page.locator('.language-btn[data-lang="ar"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-panel="teachers"] [data-i18n="teacher_management"]')).toHaveText('إدارة الأساتذة');

    await page.locator('.language-btn[data-lang="en"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('[data-panel="teachers"] [data-i18n="teacher_management"]')).toHaveText('Teacher management');

    await page.locator('.tab[data-tab="admin"]').click();
    await expect(page.locator('[data-i18n="school_dashboard"]')).toHaveText('School dashboard');
    await expect(page.locator('#dashboardPulse')).toContainText('School');
    const schoolMetric = page.locator('#dashboardPulse .dashboard-metric').first();
    await expect(schoolMetric).toContainText('School');
    await expect(schoolMetric.locator('div').first().locator('strong')).toHaveText('2');
    await expect(page.locator('#dashboardBranchGrid .branch-card')).toHaveCount(1);
    await expect(page.locator('#dashboardBranchGrid .branch-card').first()).toContainText('SP');
    const classRows = page.locator('#dashboardClassTable tbody tr');
    await expect(classRows).toHaveCount(2);
    await expect(page.locator('#dashboardClassTable')).toContainText('E2E-2BAC-A');
    await expect(page.locator('#dashboardClassTable')).toContainText('E2E-2BAC-B');

    await page.locator('.language-btn[data-lang="fr"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('admin can receive a fully signed weekly register', async ({ page }) => {
    test.skip(!teacherUsername || !teacherPassword, 'Set teacher E2E credentials to run weekly receipt isolation tests.');

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, teacherUsername, teacherPassword);
    await page.locator('#periods [data-select-period="1"]').click();
    await page.locator('#attendanceMobileList [data-attendance-toggle]').first().click();
    await page.locator('#attendanceWorkflow [data-sign-period]').click();
    await page.locator('#weeklyTeacherSignatures [data-sign-week]').click();
    await page.locator('#logoutBtn').click();
    await page.waitForURL(/login\.php$/);

    await login(page, username, password);
    await page.locator('#classSelect').selectOption({ label: 'E2E-2BAC-A' });
    await expect(page.locator('#weeklyTeacherSignatures')).toContainText('1/1');
    await expect(page.locator('#weeklyTeacherSignatures [data-receive-week]')).toBeVisible();

    await page.locator('.language-btn[data-lang="en"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.locator('#reportBtn').click();
    await expect(page.locator('#weeklyPrintSheet')).toContainText('Mathematics');

    await page.locator('#weeklyTeacherSignatures [data-receive-week]').click();
    await expect(page.locator('#weeklyTeacherSignatures .register-receipt.received')).toBeVisible();

    await page.reload();
    await expect(page.locator('#weeklyTeacherSignatures .register-receipt.received')).toBeVisible();
    await expect(page.locator('#weeklyTeacherSignatures [data-receive-week]')).toHaveCount(0);

    await page.locator('#logoutBtn').click();
    await page.waitForURL(/login\.php$/);

    await login(page, teacherUsername, teacherPassword);
    await page.locator('#periods [data-select-period="1"]').click();
    await page.locator('#attendanceWorkflow [data-reopen-period]').click();
    await expect(page.locator('#weeklyTeacherSignatures .register-receipt')).toHaveCount(0);
    await expect(page.locator('#weeklyTeacherSignatures .weekly-teacher-status.needs_resign')).toHaveCount(1);
  });

  test('admin can manage a class and a user through the UI', async ({ page }) => {
    await login(page, username, password);
    await page.locator('.tab[data-tab="admin"]').click();
    await expect(page.locator('#adminClassesTable')).toBeVisible();

    const className = 'E2E-UI-' + Date.now();
    await page.locator('#addClassBtn').click();
    await page.locator('#classNameInput').fill(className);
    await page.locator('#classLevelInput').fill('2BAC');
    await page.locator('#classBranchInput').fill('SP');
    const createClassResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/classes.php') &&
        response.request().method() === 'POST'
    );
    await page.locator('#classForm button[type="submit"]').click();
    await expect((await createClassResponse).ok()).toBeTruthy();
    await page.locator('.tab[data-tab="admin"]').click();
    const classRow = page.locator('#adminClassesTable tbody tr').filter({ hasText: className }).first();
    await expect(classRow).toBeVisible();

    await classRow.locator('[data-edit-class]').click();
    await page.locator('#editClassNameInput').fill(className + '-EDITED');
    await page.locator('#editClassForm button[type="submit"]').click();
    await expect(page.locator('#editClassDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    const editedClassRow = page.locator('#adminClassesTable tbody tr').filter({ hasText: className + '-EDITED' }).first();
    await expect(editedClassRow).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await editedClassRow.locator('[data-toggle-class]').click();
    await expect(editedClassRow.locator('td').nth(4)).toHaveText('Non');

    page.once('dialog', (dialog) => dialog.accept());
    await editedClassRow.locator('[data-toggle-class]').click();
    await expect(editedClassRow.locator('td').nth(4)).toHaveText('Oui');

    const createdUsername = 'e2e-ui-' + Date.now();
    const newPassword = 'e2e-ui-password-2026';

    await page.locator('#userUsernameInput').fill(createdUsername);
    await page.locator('#userFullNameInput').fill('E2E UI User');
    await page.locator('#userRoleInput').selectOption('teacher');
    await page.locator('#userPasswordInput').fill(newPassword);
    const createUserResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/users.php') &&
        response.request().method() === 'POST'
    );
    await page.locator('#userForm button[type="submit"]').click();
    await expect((await createUserResponse).ok()).toBeTruthy();

    await expect(page.locator('#usersTable tbody tr').filter({ hasText: createdUsername }).first()).toBeVisible();
    const userRow = page.locator('#usersTable tbody tr').filter({ hasText: createdUsername }).first();

    await userRow.locator('[data-edit-user]').click();
    await page.locator('#editUserFullNameInput').fill('E2E UI User Edited');
    await page.locator('#editUserForm button[type="submit"]').click();
    await expect(page.locator('#editUserDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    const editedUserRow = page.locator('#usersTable tbody tr').filter({ hasText: createdUsername }).first();
    await editedUserRow.locator('[data-reset-user]').click();
    await page.locator('#resetUserPasswordInput').fill('e2e-ui-password-reset-2026');
    await page.locator('#resetUserPasswordForm button[type="submit"]').click();
    await expect(page.locator('#resetUserPasswordDialog')).toBeHidden();

    await page.locator('.tab[data-tab="admin"]').click();
    await editedUserRow.locator('[data-toggle-user]').click();
    await expect(editedUserRow.locator('td').nth(3)).toHaveText('Non');
  });

  test('logout invalidates the authenticated browser session', async ({ page }) => {
    await login(page, username, password);
    await page.locator('#logoutBtn').click();
    await page.waitForURL(/login\.php$/);

    await page.goto('index.php');
    await expect(page).toHaveURL(/login\.php$/);
  });
});
