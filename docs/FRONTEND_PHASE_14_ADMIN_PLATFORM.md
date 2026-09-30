# SAMS — Frontend Phase 14 — Admin Platform

Status: PASS — 2026-09-29

## Objective

Implement the React admin platform against the canonical /api/v1 backend contract: dashboard, classes, teachers, assignments, subjects, users, onboarding, academic years, imports, audit, admin-only routing, and FR/AR/EN RTL-safe coverage.

## Implemented

The phase adds a feature-owned typed admin API layer and server-backed pages for every Phase 14 route.

Dashboard: operational summary, class statistics, attention students, missing-today classes, recent audit.

Classes: create, update, activate, deactivate. Creation follows the backend rule that the active academic year is selected server-side.

Teachers: directory, subjects, teaching assignment, unassignment, subject creation/update, online state.

Users: create/update, unlock, suspend, activate, deactivate, revoke sessions, SAMS Code reissue, password reset dialog.

Onboarding: request filtering, approve/reject, optional rejection reason, onboarding-code rotation.

Academic years: list, create, optional activation on create, explicit activation confirmation.

Imports: upload, preview, reconcile, commit. Upload uses FormData. Commit is disabled until reconciled class state is mapped.

Audit: server-side filters and pagination; read-only presentation.

Routing: admin placeholders were replaced by functional pages. Archive remains the Phase 15 placeholder.
## ECC — RED findings and fixes

### Import preview tenant-scope bug

The GET import preview path called preview without the authenticated user even though preview depended on the authenticated school scope. The smallest safe fix passes the user through and applies user.school_id to the repository lookup.

This closes a tenant-isolation gap without changing the import workflow semantics.

### Multipart request handling

The shared API client now detects FormData, leaves multipart boundary handling to the browser, and only applies application/json to non-FormData bodies.

### Import workflow guard

The UI does not expose commit until the preview reports reconciled mapped classes. The backend remains the final authority.

### Admin correctness review

Subject edits preserve the existing active/inactive state. User creation now keeps submission disabled until required username/employee-id and password input is present.
## Files changed

Core Phase 14 files:

- frontend/src/features/admin/api.ts
- frontend/src/features/admin/types.ts
- frontend/src/features/admin/helpers.ts
- frontend/src/features/admin/useAdminResource.ts
- frontend/src/pages/app/AdminDashboardPage.tsx
- frontend/src/pages/app/AdminClassesPage.tsx
- frontend/src/pages/app/AdminTeachersPage.tsx
- frontend/src/pages/app/AdminUsersPage.tsx
- frontend/src/pages/app/AdminOnboardingPage.tsx
- frontend/src/pages/app/AdminAcademicYearsPage.tsx
- frontend/src/pages/app/AdminImportsPage.tsx
- frontend/src/pages/app/AdminAuditPage.tsx
- frontend/src/routes/router.tsx
- frontend/src/features/i18n/types.ts
- frontend/src/features/i18n/dictionary.ts
- frontend/src/services/api/client.ts
- backend/src/Controllers/SchoolImportController.php
- tests/e2e/frontend_phase14_admin_platform.spec.js

Earlier Phase 11–13 local changes were preserved.
## Verification

Phase 14 E2E:

SAMS_BASE_URL=http://127.0.0.1:5173/ npx playwright test tests/e2e/frontend_phase14_admin_platform.spec.js --project=chromium

Result: 5 passed.

Cross-phase regression:

SAMS_BASE_URL=http://127.0.0.1:5173/ npx playwright test tests/e2e/frontend_phase14_admin_platform.spec.js tests/e2e/frontend_phase12_attendance_reliability.spec.js tests/e2e/frontend_phase13_students_classes.spec.js --project=chromium

Result: 20 passed.

Static gates:

- TypeScript typecheck: PASS
- Oxlint: PASS — 0 warnings / 0 errors
- Vite production build: PASS
- PHP syntax check for changed import controller: PASS
- git diff --check: PASS

The current Codespace does not expose the normal MariaDB/PHP extension environment, so DB-backed integration execution is not claimed from this session.

## Gate

# PASS

Current project state:

Phase 1–14 = PASS

Next frontier: Phase 15 — Archive / Reports / Signatures.

Design R&D and Figma remain deferred until after Phase 24.
