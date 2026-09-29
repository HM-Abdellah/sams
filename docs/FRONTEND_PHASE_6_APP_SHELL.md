# Frontend Phase 6 — Application Shell and Navigation

## Objective

Establish the protected application shell and route/navigation infrastructure without introducing final visual identity or feature business logic.

## Implemented

- Centralized route definitions in `frontend/src/routes/route-config.ts`.
- Role-aware navigation for `teacher` and `admin`.
- Full conceptual application route skeleton from the frozen frontend architecture.
- Public onboarding route boundaries for request, status, and activation.
- Teacher routes for attendance, students, signatures, and reports.
- Admin routes for dashboard, classes, teachers, users, onboarding, academic years, imports, archive, and audit.
- `/app` role landing redirects to the first role-specific workspace.
- Superseded placeholder workspace files removed after their route replacements existed.
- Navigation remains functional and visually minimal so the later design system can replace its presentation without changing feature logic.

## Security boundary

React route guards remain UX/navigation controls only.

Backend PHP authorization remains authoritative for every protected API operation.

No client-side role check is treated as an authorization mechanism.

## Verification

- TypeScript: PASS.
- Oxlint: PASS — 0 warnings / 0 errors.
- Production build: PASS.
- Playwright container smoke: PASS — teacher/admin landing, navigation isolation, and role guards.
- `git diff --check`: PASS.
- Temporary test files and development servers were removed after verification.

## Gate

Phase 6 closes when route topology, role-aware navigation, and protected workspace boundaries are verified while final visual design remains replaceable.

**Status: PASS**

## Current project state

Frontend engineering phases 1–6 are closed. The next phase continues on top of this shell without changing the backend contract or final visual direction.
