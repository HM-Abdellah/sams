import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

async function installAnonymousSession(page) {
  await page.route("**/api/v1/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { authenticated: false, user: null, csrf: "" },
      }),
    });
  });
}

async function installCounselorSession(page) {
  await page.route("**/api/v1/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          authenticated: true,
          user: {
            id: 4,
            school_id: 20,
            employee_id: "counselor.e2e",
            full_name: "E2E Counselor",
            role: "counselor",
            account_status: "active",
          },
          csrf: "e2e-csrf",
        },
      }),
    });
  });
  await page.route("**/api/classes.php", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          classes: [
            {
              id: 1,
              name: "E2E-2BAC-A",
              level: "2BAC",
              branch: "SP",
              academic_year_id: 1,
              academic_year_name: "2026/2027",
            },
            {
              id: 2,
              name: "E2E-2BAC-B",
              level: "2BAC",
              branch: "SP",
              academic_year_id: 1,
              academic_year_name: "2026/2027",
            },
          ],
        },
      }),
    });
  });
}

test.describe("frontend Phase 24 final audit", () => {
  test("public onboarding request produces a trackable request token", async ({
    page,
  }) => {
    await installAnonymousSession(page);
    let requestPayload = null;
    await page.route("**/api/v1/onboarding/request", async (route) => {
      requestPayload = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            request_id: 7,
            request_token: "a".repeat(64),
            status: "pending",
            expires_at: "2026-10-01T00:00:00Z",
          },
        }),
      });
    });
    await page.route("**/api/v1/onboarding/status**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            request_id: 7,
            status: "pending",
            expires_at: "2026-10-01T00:00:00Z",
            activated: false,
          },
        }),
      });
    });

    await page.goto("/onboarding");
    await page.getByLabel("Onboarding code").fill("PUBLIC-CODE");
    await page.getByLabel("Full name").fill("Final Audit Teacher");
    await page.getByLabel("Employee ID").fill("AUDIT-001");
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByText("a".repeat(64), { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding$/);
    expect(requestPayload).toMatchObject({
      onboarding_code: "PUBLIC-CODE",
      full_name: "Final Audit Teacher",
      employee_id: "AUDIT-001",
    });
    await page.getByRole("button", { name: "Track request" }).click();
    await expect(page).toHaveURL(/\/onboarding\/status$/);
    await expect(
      page.getByRole("heading", { name: "Request status" }),
    ).toBeVisible();
  });

  test("approved onboarding request exposes activation without placeholder UI", async ({
    page,
  }) => {
    await installAnonymousSession(page);
    await page.route("**/api/v1/onboarding/status**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            request_id: 7,
            status: "approved",
            expires_at: "2026-10-01T00:00:00Z",
            activated: false,
          },
        }),
      });
    });
    await page.goto("/onboarding/status?request_token=approved-token");
    await expect(
      page.getByRole("heading", { name: "Request status" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Activate your teacher account" }),
    ).toBeVisible();
    await expect(page.getByText(/will be connected/i)).toHaveCount(0);
  });

  test("activation returns the one-time SAMS Code and links to login", async ({
    page,
  }) => {
    await installAnonymousSession(page);
    await page.route("**/api/v1/onboarding/activate", async (route) => {
      expect(JSON.parse(route.request().postData() || "{}")).toMatchObject({
        request_token: "approved-token",
        password: "SafePassword123!",
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            request_id: 7,
            user_id: 9,
            sams_code: "T123456",
            session_version: 1,
          },
        }),
      });
    });
    await page.goto("/onboarding/activate?request_token=approved-token");
    await page.getByLabel("Initial password").fill("SafePassword123!");
    await page.getByRole("button", { name: "Activate account" }).click();
    await expect(page.getByText("T123456", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("counselor workspace is functional and remains read-only", async ({
    page,
  }) => {
    await installCounselorSession(page);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app\/counselor$/);
    await expect(
      page.getByRole("heading", { name: "Counselor workspace" }),
    ).toBeVisible();
    await expect(page.getByText("E2E-2BAC-A", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E-2BAC-B", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "This view is read-only and authorization remains server-controlled.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Archive" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
    await expect(page.getByText(/modules .*later/i)).toHaveCount(0);
  });
});

test("onboarding request page has no automated accessibility violations", async ({
  page,
}) => {
  await installAnonymousSession(page);
  await page.goto("/onboarding");
  await expect(
    page.getByRole("heading", { name: "Create your teacher access" }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
