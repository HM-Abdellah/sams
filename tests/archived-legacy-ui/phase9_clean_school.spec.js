import { test, expect } from '@playwright/test';

const adminUsername = process.env.SAMS_ACCEPTANCE_ADMIN_USERNAME || 'admin';
const adminPassword = process.env.SAMS_ACCEPTANCE_ADMIN_PASSWORD;
const counselorUsername = 'counselor.phase9';
const counselorPassword = process.env.SAMS_ACCEPTANCE_COUNSELOR_PASSWORD;
const teacherAUsername = 'teacher.phase9.a';
const teacherAPassword = process.env.SAMS_ACCEPTANCE_TEACHER_A_PASSWORD;
const teacherBUsername = 'teacher.phase9.b';
const teacherBPassword = process.env.SAMS_ACCEPTANCE_TEACHER_B_PASSWORD;

const classA = 'PH9-2BAC-A';
const classB = 'PH9-2BAC-B';
const attendanceDate = '2026-10-02';
const weekStart = '2026-09-28';
const transferDate = '2026-10-05';

test.beforeAll(() => {
  if (![adminPassword, counselorPassword, teacherAPassword, teacherBPassword].every(Boolean)) {
    throw new Error('Phase 9 acceptance credentials are incomplete.');
  }
});

async function login(page, username, password, { expectEmptySchool = false } = {}) {
  await page.goto('login.php');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/auth.php?action=login') &&
      response.request().method() === 'POST'
  );

  await page.locator('#loginBtn').click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  await page.waitForURL(/index\.php$/);
  await expect(page.locator('#logoutBtn')).toBeVisible();

  if (expectEmptySchool) {
    await expect(page.locator('#classSelect option:not([disabled])')).toHaveCount(0);
    await expect(page.locator('.tab[data-tab="admin"]')).toHaveCount(1);
  }
}

async function logout(page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/auth.php?action=logout') &&
      response.request().method() === 'POST'
  );
  await page.locator('#logoutBtn').click();
  expect((await responsePromise).ok()).toBeTruthy();
  await page.waitForURL(/login\.php$/);
}

async function createUser(page, { username, fullName, role, password }) {
  await page.locator('#userUsernameInput').fill(username);
  await page.locator('#userFullNameInput').fill(fullName);
  await page.locator('#userRoleInput').selectOption(role);
  await page.locator('#userPasswordInput').fill(password);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/users.php') &&
      response.request().method() === 'POST'
  );
  await page.locator('#userForm button[type="submit"]').click();
  expect((await responsePromise).ok()).toBeTruthy();
  await expect(page.locator('#usersTable tbody tr').filter({ hasText: username })).toHaveCount(1);
}

async function createAcademicYear(page) {
  await page.locator('#academicYearNameInput').fill('2026/2027');
  await page.locator('#academicYearStartInput').fill('2026-09-01');
  await page.locator('#academicYearEndInput').fill('2027-07-31');
  await page.locator('#academicYearActivateInput').selectOption('1');

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/academic-years.php') &&
      response.request().method() === 'POST'
  );
  await page.locator('#academicYearForm button[type="submit"]').click();
  expect((await responsePromise).ok()).toBeTruthy();
  await expect(
    page.locator('#academicYearsTable tbody tr').filter({ hasText: '2026/2027' })
  ).toContainText('Oui');
}

async function createClass(page, name) {
  await page.locator('#addClassBtn').click();
  await page.locator('#classNameInput').fill(name);
  await page.locator('#classLevelInput').fill('2BAC');
  await page.locator('#classBranchInput').fill('Sciences Physiques');

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/classes.php') &&
      response.request().method() === 'POST'
  );
  await page.locator('#classForm button[type="submit"]').click();
  expect((await responsePromise).ok()).toBeTruthy();
  await expect(page.locator('#adminClassesTable tbody tr').filter({ hasText: name })).toHaveCount(1);
  await expect(page.locator('#classSelect option').filter({ hasText: name })).toHaveCount(1);
}

async function assignTeacher(page, username, className) {
  await expect(page.locator('#assignmentForm')).toBeVisible();

  const classOption = page.locator('#assignmentClassInput option').filter({ hasText: className }).first();
  await expect(classOption).toHaveCount(1);
  const classValue = await classOption.getAttribute('value');
  expect(classValue).toBeTruthy();

  const teacherOption = page.locator('#assignmentTeacherInput option').filter({ hasText: username }).first();
  await expect(teacherOption).toHaveCount(1);
  const teacherValue = await teacherOption.getAttribute('value');
  expect(teacherValue).toBeTruthy();

  await page.locator('#assignmentTeacherInput').selectOption(teacherValue);
  await page.locator('#assignmentClassInput').selectOption(classValue);
  await expect(page.locator('#assignmentClassInput')).toHaveValue(classValue);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/teacher-classes.php') &&
      response.request().method() === 'POST'
  );
  await page.locator('#assignmentForm button[type="submit"]').click();
  const assignmentResponse = await responsePromise;
  expect(assignmentResponse.ok()).toBeTruthy();

  const verifyUrl = new URL(
    '../api/teacher-classes.php?class_id=' + encodeURIComponent(classValue),
    page.url()
  ).toString();
  const verification = await page.request.get(verifyUrl);
  expect(verification.ok()).toBeTruthy();
  const payload = await verification.json();
  expect(payload.data?.teachers?.some((teacher) => teacher.username === username)).toBe(true);
}

async function selectOperationalClass(page, className) {
  const option = page.locator('#classSelect option').filter({ hasText: className }).first();
  await expect(option).toHaveCount(1);
  const classValue = await option.getAttribute('value');
  expect(classValue).toBeTruthy();

  const studentsResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/students.php?class_id=' + encodeURIComponent(classValue)) &&
      response.request().method() === 'GET'
  );
  const attendanceResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/attendance.php?class_id=' + encodeURIComponent(classValue)) &&
      response.url().includes('week_start=') &&
      response.request().method() === 'GET'
  );
  const signoffResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/attendance-signoffs.php?class_id=' + encodeURIComponent(classValue)) &&
      response.request().method() === 'GET'
  );

  await page.locator('#classSelect').selectOption(classValue);
  await Promise.all([studentsResponse, attendanceResponse, signoffResponse]);
  await expect(page.locator('#classSelect')).toHaveValue(classValue);

  return classValue;
}

async function stageAndImport(page, filename, { correctFirstBatchRow = false } = {}) {
  await page.locator('.tab[data-tab="admin"]').click();
  await page.locator('#studentImportFile').setInputFiles(filename);

  const stageResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/imports.php') &&
      response.request().method() === 'POST'
  );
  await page.locator('#importForm button[type="submit"]').click();
  expect((await stageResponsePromise).ok()).toBeTruthy();

  const name = filename.split('/').pop();
  const row = page.locator('#importsTable tbody tr').filter({ hasText: name }).first();
  await expect(row).toBeVisible();

  if (correctFirstBatchRow) {
    await row.locator('[data-edit-import]').click();
    await expect(page.locator('#importCorrectionDialog')).toBeVisible();

    const invalidRow = page.locator(
      '#importCorrectionRows .import-correction-row:has(input[name="massar_code"][value="E2EIMP002"])'
    ).first();
    await expect(invalidRow).toBeVisible();
    const invalidDate = invalidRow.locator('input[name="birth_date"]');
    await expect(invalidDate).toHaveValue('');
    await invalidDate.fill('2010-03-15');

    await page.locator('#importCorrectionForm button[type="submit"]').click();
    await expect(page.locator('#importCorrectionDialog')).toBeHidden();
    await expect(
      page.locator('#importsTable tbody tr').filter({ hasText: name }).first()
    ).toContainText('validated');
  }

  const importRow = page.locator('#importsTable tbody tr').filter({ hasText: name }).first();
  await expect(importRow.locator('[data-run-import]')).toBeEnabled();

  page.once('dialog', (dialog) => dialog.accept());
  const importResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/imports.php') &&
      response.request().method() === 'POST'
  );
  await importRow.locator('[data-run-import]').click();
  expect((await importResponsePromise).ok()).toBeTruthy();
  await expect(importRow).toContainText('imported');
}

async function selectAttendanceDay(page) {
  await page.locator('#weekStart').fill(weekStart);
  await page.locator('#weekStart').press('Tab');
  await expect(page.locator('#weekStart')).toHaveValue(weekStart);
  await expect(page.locator('#weekDays [data-select-day="' + attendanceDate + '"]')).toBeVisible();
  await page.locator('#weekDays [data-select-day="' + attendanceDate + '"]').click();
  await page.locator('#periods [data-select-period="1"]').click();
}

async function toggleAttendanceAndSave(page) {
  const expectedClassId = await page.locator('#classSelect').inputValue();
  const button = page.locator('#attendanceTable tbody tr').filter({ hasText: 'Import Valid' }).locator('[data-attendance-toggle]').first();
  await expect(button).toBeVisible();
  const expectedStudentId = await button.getAttribute('data-student');

  const requestPromise = page.waitForRequest(
    (request) =>
      request.url().includes('/api/attendance.php?class_id=') &&
      request.method() === 'POST'
  );
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/attendance.php?class_id=') &&
      response.request().method() === 'POST'
  );

  await button.click();

  const request = await requestPromise;
  const response = await responsePromise;
  const requestUrl = new URL(request.url());
  const body = request.postDataJSON();
  const requestClassId = requestUrl.searchParams.get('class_id') || '';
  const requestStudentId = String(body.entries?.[0]?.student_id || '');
  if (requestClassId !== String(expectedClassId) || requestStudentId !== String(expectedStudentId)) {
    throw new Error(
      'Phase 9 attendance request mismatch: selected class=' + expectedClassId
      + ' request class=' + requestClassId
      + ' request student=' + requestStudentId
      + ' button student=' + String(expectedStudentId || '')
    );
  }

  if (!response.ok()) {
    throw new Error('Phase 9 attendance save failed: HTTP ' + response.status() + ' ' + await response.text());
  }
  const payload = await response.json();
  expect(payload.success).toBe(true);
  expect(payload.data?.changed).toBe(1);
  return button;
}

async function saveClassSignature(page) {
  await page.locator('.tab[data-tab="signature"]').click();
  const canvas = page.locator('#signatureCanvas');
  await expect(canvas).toBeVisible();

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/signatures.php?class_id=') &&
      response.request().method() === 'POST'
  );

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box.x + 180, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 280, box.y + 110);
  await page.mouse.move(box.x + 380, box.y + 170);
  await page.mouse.up();

  await page.locator('#saveSignatureBtn').click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
}

async function signLesson(page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/attendance-signoffs.php') &&
      response.request().method() === 'POST'
  );
  await page.locator('#attendanceWorkflow [data-sign-period]').click();
  expect((await responsePromise).ok()).toBeTruthy();
  await expect(page.locator('#attendanceWorkflow .attendance-seal')).toContainText(
    /Validée par|Certified by|تمت المصادقة/
  );
}

test('Phase 9 — clean-school acceptance scenario', async ({ page }) => {
  await login(page, adminUsername, adminPassword, { expectEmptySchool: true });
  await page.locator('.tab[data-tab="admin"]').click();

  await createUser(page, {
    username: counselorUsername,
    fullName: 'Phase 9 Counselor',
    role: 'counselor',
    password: counselorPassword,
  });
  await createUser(page, {
    username: teacherAUsername,
    fullName: 'Phase 9 Teacher A',
    role: 'teacher',
    password: teacherAPassword,
  });
  await createUser(page, {
    username: teacherBUsername,
    fullName: 'Phase 9 Teacher B',
    role: 'teacher',
    password: teacherBPassword,
  });

  await createAcademicYear(page);
  await createClass(page, classA);
  await assignTeacher(page, teacherAUsername, classA);
  await createClass(page, classB);
  await assignTeacher(page, teacherBUsername, classB);

  await selectOperationalClass(page, classA);
  await stageAndImport(page, 'tests/fixtures/students-invalid.csv', {
    correctFirstBatchRow: true,
  });

  await page.locator('.tab[data-tab="students"]').click();
  await expect(page.locator('#studentsList .student-card').filter({ hasText: 'E2EIMP001' })).toHaveCount(1);
  await expect(page.locator('#studentsList .student-card').filter({ hasText: 'E2EIMP002' })).toHaveCount(1);

  await page.locator('#addStudentBtn').click();
  await page.locator('#firstNameInput').fill('Phase 9');
  await page.locator('#lastNameInput').fill('Manual Student');
  await page.locator('#massarInput').fill('PH9MAN001');
  await page.locator('#birthDateInput').fill('2010-09-09');
  await page.locator('#studentNumberInput').fill('A099');

  const manualCreateResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/students.php?class_id=') &&
      response.request().method() === 'POST'
  );
  await page.locator('#studentForm button[type="submit"]').click();
  expect((await manualCreateResponse).ok()).toBeTruthy();

  const manualCard = page.locator('#studentsList .student-card').filter({ hasText: 'PH9MAN001' }).first();
  await expect(manualCard).toBeVisible();
  await manualCard.locator('[data-edit-student]').click();
  await page.locator('#editFirstNameInput').fill('Phase 9 Edited');

  const manualUpdateResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/students.php?class_id=') &&
      response.request().method() === 'POST'
  );
  await page.locator('#editStudentForm button[type="submit"]').click();
  expect((await manualUpdateResponse).ok()).toBeTruthy();
  await expect(
    page.locator('#studentsList .student-card').filter({ hasText: 'PH9MAN001' })
  ).toContainText('Phase 9 Edited');

  page.once('dialog', (dialog) => dialog.accept());
  const manualDeactivateResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/students.php?class_id=') &&
      response.request().method() === 'POST'
  );
  await manualCard.locator('[data-delete-student]').click();
  expect((await manualDeactivateResponse).ok()).toBeTruthy();

  await selectOperationalClass(page, classB);
  await stageAndImport(page, 'tests/fixtures/phase9-class-b.csv');

  await page.locator('.tab[data-tab="attendance"]').click();
  await selectOperationalClass(page, classA);
  await expect(page.locator('#studentsList .student-card').filter({ hasText: 'E2EIMP001' })).toHaveCount(1);
  const adminAttendanceToggle = page.locator('#attendanceTable tbody tr').filter({ hasText: 'Import Valid' }).locator('[data-attendance-toggle]').first();
  await expect(adminAttendanceToggle).toBeVisible();
  await selectAttendanceDay(page);
  await toggleAttendanceAndSave(page);
  await expect(adminAttendanceToggle).toHaveText('X');

  await logout(page);
  await login(page, teacherAUsername, teacherAPassword);
  await expect(page.locator('#classSelect option:not([disabled])')).toHaveCount(1);
  await expect(page.locator('#classSelect option:checked')).toContainText(classA);
  await page.locator('.tab[data-tab="attendance"]').click();
  await selectOperationalClass(page, classA);
  await selectAttendanceDay(page);
  await saveClassSignature(page);
  await page.locator('.tab[data-tab="attendance"]').click();
  await selectOperationalClass(page, classA);
  await selectAttendanceDay(page);

  const attendanceToggle = page.locator('#attendanceTable tbody tr').filter({ hasText: 'Import Valid' }).locator('[data-attendance-toggle]').first();
  await expect(attendanceToggle).toBeVisible();
  await expect(attendanceToggle).toHaveText('X');
  await signLesson(page);

  const reopenPromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/attendance-signoffs.php') &&
      response.request().method() === 'POST'
  );
  await page.locator('#attendanceWorkflow [data-reopen-period]').click();
  expect((await reopenPromise).ok()).toBeTruthy();
  await expect(page.locator('#attendanceWorkflow .attendance-seal')).toContainText(
    /Correction|re-sign|إعادة/
  );

  const clearResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/attendance.php') &&
      response.request().method() === 'POST'
  );
  await attendanceToggle.click();
  const clearResponse = await clearResponsePromise;
  expect(clearResponse.ok()).toBeTruthy();
  expect((await clearResponse.json()).data?.changed).toBe(1);
  await expect(attendanceToggle).toHaveText('');

  await toggleAttendanceAndSave(page);
  await expect(attendanceToggle).toHaveText('X');
  await signLesson(page);

  const weeklySignResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/attendance-signoffs.php') &&
      response.request().method() === 'POST'
  );
  await page.locator('#weeklyTeacherSignatures [data-sign-week]').click();
  expect((await weeklySignResponsePromise).ok()).toBeTruthy();
  await expect(page.locator('#weeklyTeacherSignatures .weekly-teacher-status.signed')).toHaveCount(1);

  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.locator('#reportBtn').click();
  await expect(page.locator('#weeklyPrintSheet')).toContainText(classA);
  await expect(page.locator('#weeklyPrintSheet')).toContainText('Import Valid');

  
  await logout(page);

  await login(page, teacherBUsername, teacherBPassword);
  await expect(page.locator('#classSelect option:not([disabled])')).toHaveCount(1);
  await expect(page.locator('#classSelect option:checked')).toContainText(classB);
  await page.locator('.tab[data-tab="students"]').click();
  await expect(page.locator('#studentsList .student-card').filter({ hasText: 'Phase9 Sara' })).toHaveCount(1);
  await logout(page);

  await login(page, teacherAUsername, teacherAPassword);
  await expect(page.locator('#classSelect option:not([disabled])')).toHaveCount(1);
  await expect(page.locator('#classSelect option:checked')).toContainText(classA);
  await page.locator('.tab[data-tab="students"]').click();
  await expect(page.locator('#studentsList .student-card').filter({ hasText: 'Phase9 Sara' })).toHaveCount(0);
  await logout(page);

  await login(page, adminUsername, adminPassword);
  await page.locator('#classSelect').selectOption({ label: classA });
  await page.locator('.tab[data-tab="students"]').click();

  const transferCard = page.locator('#studentsList .student-card').filter({ hasText: 'E2EIMP001' }).first();
  await expect(transferCard).toBeVisible();
  await transferCard.locator('[data-transfer-student]').click();
  await expect(page.locator('#transferStudentDialog')).toBeVisible();
  await page.locator('#transferTargetClassInput').selectOption({ label: classB });
  await page.locator('#transferEffectiveDateInput').fill(transferDate);

  const transferResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/students.php?class_id=') &&
      response.request().method() === 'POST'
  );
  await page.locator('#transferStudentForm button[type="submit"]').click();
  expect((await transferResponsePromise).ok()).toBeTruthy();
  await expect(page.locator('#transferStudentDialog')).toBeHidden();

  await selectOperationalClass(page, classA);
  await expect(page.locator('#studentsList .student-card').filter({ hasText: 'E2EIMP001' })).toHaveCount(0);

  await page.locator('.tab[data-tab="archive"]').click();
  await page.locator('#archiveMonth').fill('2026-10');

  const archiveDaysPromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/archive.php?') &&
      response.request().method() === 'GET'
  );
  await page.locator('#loadArchiveBtn').click();
  expect((await archiveDaysPromise).ok()).toBeTruthy();

  const archiveDay = page.locator('#archiveTable tbody tr').filter({ hasText: attendanceDate }).first();
  await expect(archiveDay).toBeVisible();
  await archiveDay.locator('[data-archive-day]').click();
  await expect(page.locator('#archiveDayDialog')).toContainText('Import Valid');
  await page.locator('#archiveDayDialog [data-close-dialog="archiveDayDialog"]').click();
  await expect(page.locator('#archiveDayDialog')).toBeHidden();

  const monthResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/archive.php?') &&
      response.request().method() === 'GET'
  );
  await page.locator('[data-archive-view="month"]').click();
  expect((await monthResponsePromise).ok()).toBeTruthy();

  const historyRow = page.locator('#archiveTable tbody tr').filter({ hasText: 'Import Valid' }).first();
  await expect(historyRow).toBeVisible();
  await historyRow.locator('[data-student-history]').click();
  await expect(page.locator('#studentHistoryDialog')).toContainText(attendanceDate);
  await expect(page.locator('#studentHistoryDialog')).toContainText(
    /absent|Absence|Absent/
  );
  await page.locator('#studentHistoryDialog [data-close-dialog="studentHistoryDialog"]').click();
  await expect(page.locator('#studentHistoryDialog')).toBeHidden();

  await page.locator('.tab[data-tab="admin"]').click();
  await expect(page.locator('#usersTable tbody tr').filter({ hasText: counselorUsername })).toHaveCount(1);
  await expect(page.locator('#usersTable tbody tr').filter({ hasText: teacherAUsername })).toHaveCount(1);
  await expect(page.locator('#usersTable tbody tr').filter({ hasText: teacherBUsername })).toHaveCount(1);

  await logout(page);

  await login(page, counselorUsername, counselorPassword);
  await expect(page.locator('#classSelect option:not([disabled])')).toHaveCount(2);
  await expect(page.locator('.tab[data-tab="admin"]')).toHaveCount(0);
  await expect(page.locator('.tab[data-tab="archive"]')).toHaveCount(0);

  const counselorClassId = await page.locator('#classSelect option').filter({ hasText: classA }).getAttribute('value');
  expect(counselorClassId).toBeTruthy();
  const counselorArchiveUrl = new URL(
    '../api/archive.php?class_id=' + counselorClassId + '&view=days&month=2026-10',
    page.url()
  ).toString();
  const counselorArchive = await page.evaluate(async (url) => {
    const response = await fetch(url, { credentials: 'same-origin' });
    return { status: response.status, body: await response.text() };
  }, counselorArchiveUrl);
  if (counselorArchive.status !== 403) {
    throw new Error(
      'Phase 9 counselor archive access check failed: HTTP ' +
      counselorArchive.status + ' ' + counselorArchive.body +
      ' URL=' + counselorArchiveUrl
    );
  }
  await logout(page);

  await page.goto('index.php');
  await expect(page).toHaveURL(/login\.php$/);
});
