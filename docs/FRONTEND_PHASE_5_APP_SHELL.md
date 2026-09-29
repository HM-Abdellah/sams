# Frontend Phase 5 — Routing and Application Shell

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

## Route boundary acceptance

The shell now includes:

- loading boundary while session bootstrap is pending;
- session-unavailable error state with retry;
- public/authenticated route separation;
- role-aware protected routes;
- explicit Unauthorized page for authenticated role mismatches;
- explicit 404 page for unknown routes;
- React Router error boundaries for route/render failures.

React guards remain UX/navigation controls only. Backend authorization remains authoritative.

## Gate

Phase 5 closes when routing, role-aware navigation, loading/error boundaries, 404 handling, and unauthorized handling are verified.

**Status: PASS**

## Current project state

Official Phase 5 is PASS. The earlier implementation batch was labelled Phase 6 before the official roadmap was supplied; the file has been reconciled to the official numbering.
