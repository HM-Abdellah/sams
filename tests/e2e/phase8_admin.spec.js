  test('teacher assignment changes access and can be restored', async ({ page }) => {
    await login(page, adminUsername, adminPassword);
    await page.locator('#classSelect').selectOption({ label: 'E2E-2BAC-A' });
    await expect.poll(
      async () => page.locator('#attendanceMobileList .attendance-student-card').count()
    ).toBeGreaterThanOrEqual(3);
    await page.locator('.tab[data-tab="admin"]').click();

    let row = page.locator('#assignmentsTable tbody tr').filter({ hasText: 'E2E Teacher' }).first();
    await expect(row).toBeVisible();

    const removeA = page.waitForResponse(
      (response) => response.url().includes('/api/teacher-classes.php') && response.request().method() === 'DELETE'
    );
    await row.locator('[data-unassign-teacher]').click();
    expect((await removeA).ok()).toBeTruthy();

    await expect(
      page.locator('#assignmentsTable tbody tr').filter({ hasText: 'E2E Teacher' })
    ).toHaveCount(0);
    await page.locator('#assignmentTeacherInput').selectOption({ value: '2' });
    await page.locator('#assignmentClassInput').selectOption({ value: '2' });
    await expect(page.locator('#assignmentClassInput')).toHaveValue('2');

    const assignB = page.waitForResponse(
      (response) => response.url().includes('/api/teacher-classes.php') && response.request().method() === 'POST'
    );
    await page.locator('#assignmentForm button[type="submit"]').click();
    expect((await assignB).ok()).toBeTruthy();

    await logout(page);
    const teacherClassesResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/classes.php') &&
        response.request().method() === 'GET'
    );
    await login(page, teacherUsername, teacherPassword);
    const teacherClassesHttp = await teacherClassesResponse;
    const teacherClassesBody = await teacherClassesHttp.text();
    expect(teacherClassesHttp.ok(), `Teacher classes response HTTP ${teacherClassesHttp.status()}: ${teacherClassesBody}`).toBeTruthy();
    await expect.poll(
      async () => page.locator('#classSelect option:not([disabled])').count()
    ).toBeGreaterThanOrEqual(1);
    const visibleTeacherClasses = await page.locator('#classSelect option:not([disabled])').allTextContents();
    expect(visibleTeacherClasses, `Visible teacher classes: ${JSON.stringify(visibleTeacherClasses)}; API: ${teacherClassesBody}`).toContain('E2E-2BAC-B');
    await logout(page);

    await login(page, adminUsername, adminPassword);
    await page.locator('#classSelect').selectOption({ label: 'E2E-2BAC-A' });
    await expect.poll(
      async () => page.locator('#attendanceMobileList .attendance-student-card').count()
    ).toBeGreaterThanOrEqual(3);
    await page.locator('.tab[data-tab="admin"]').click();

    await page.locator('#assignmentTeacherInput').selectOption({ value: '2' });