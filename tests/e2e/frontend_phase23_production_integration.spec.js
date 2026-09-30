import { test, expect } from "@playwright/test";

const teacherCode = process.env.SAMS_E2E_TEACHER_SAMS_CODE || "T100002";
const teacherPassword =
  process.env.SAMS_E2E_TEACHER_PASSWORD || "e2e-teacher-password-2026";
const adminCode = process.env.SAMS_E2E_ADMIN_SAMS_CODE || "A100001";
const adminPassword =
  process.env.SAMS_E2E_PASSWORD || "e2e-admin-password-2026";

async function login(page, samsCode, password) {
  await page.goto("/sams/login");
  await page.getByLabel("SAMS Code").fill(samsCode);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("frontend Phase 23 production integration", () => {
  test("Apache serves the React mount, assets, and SPA routes", async ({
    page,
  }) => {
    const rootResponse = await page.goto("/sams/");
    expect(rootResponse?.status()).toBe(200);
    await expect(page).toHaveTitle(
      "SAMS — Student Attendance Management System",
    );

    await page.goto("/sams/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    const stylesheet = page.locator('link[rel="stylesheet"]').first();
    await expect(stylesheet).toHaveAttribute("href", /\/sams\/assets\//);

    const clientRoute = await page.request.get("/sams/app/teacher");
    expect(clientRoute.status()).toBe(200);
    expect(await clientRoute.text()).toContain(
      "SAMS — Student Attendance Management System",
    );
  });

  test("same-origin PHP API is reachable at the production mount", async ({
    page,
  }) => {
    const response = await page.request.get("/sams/api/v1/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      data: { api_version: "v1", status: "ok" },
    });
  });

  test("teacher authentication survives a production-page reload", async ({
    page,
  }) => {
    await login(page, teacherCode, teacherPassword);
    await expect(page).toHaveURL(/\/sams\/app\/teacher$/);
    await expect(
      page.getByRole("heading", { name: "Teacher workspace" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Teacher workspace" }),
    ).toBeVisible();

    const session = await page.request.get("/sams/api/v1/auth/session");
    expect(session.status()).toBe(200);
    const body = await session.json();
    expect(body.data.authenticated).toBe(true);
    expect(body.data.user.role).toBe("teacher");
    expect(body.data.csrf).toEqual(expect.any(String));
  });

  test("admin reaches the production console and logout closes access", async ({
    page,
  }) => {
    await login(page, adminCode, adminPassword);
    await expect(page).toHaveURL(/\/sams\/app\/admin\/dashboard$/);
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sams\/login$/);
    await page.goto("/sams/app/admin/dashboard");
    await expect(page).toHaveURL(/\/sams\/login$/);
  });

  test("retired PHP UI entry points return Gone instead of serving legacy UI", async ({
    page,
  }) => {
    const legacyLogin = await page.request.get("/sams/public/login.php", {
      maxRedirects: 0,
    });
    const legacyIndex = await page.request.get("/sams/public/index.php", {
      maxRedirects: 0,
    });
    expect(legacyLogin.status()).toBe(410);
    expect(legacyIndex.status()).toBe(410);
  });
});
