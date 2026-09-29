# SAMS — Frontend Phase 10 — Teacher Workflow

Status: PASS — 2026-09-29

## Objective

Build the first real teacher-facing workflow on top of the verified backend contract.

Phase 10 establishes:

- a teacher dashboard/workspace;
- assigned-class navigation;
- teacher roster access;
- teacher-facing monthly statistics;
- feature-owned server state;
- URL state for selected class and report month.

Deep attendance interaction remains owned by Phase 11.
Deep signature workflows remain owned by Phase 15.

## Implemented

### Teacher dashboard

Teacher `/app` now lands on `/app/teacher`.

The workspace loads the teacher's operational classes from the existing class API and exposes direct actions for:

- attendance entry;
- student roster.

No client-side class authorization was invented. The backend class API remains the authority for visibility.
### Students

`/app/students?class_id=ID` now:

- loads the teacher's available classes;
- keeps the selected class in URL state;
- loads the class roster through the existing student API;
- supports local student search;
- handles loading, empty, and error states;
- uses the shared component system.

The page does not mirror the database globally. Roster data remains feature-owned server state.

### Statistics

`/app/reports?class_id=ID&month=YYYY-MM` now:

- selects an operational teacher class;
- selects a report month;
- keeps both values in URL state;
- loads the verified canonical monthly report;
- derives aggregate present/absent/late/excused/recorded totals;
- renders per-student monthly totals;
- handles loading, empty, and error states.

The report adapter now uses a concrete typed student-total contract instead of `unknown` fields.

### API migration boundary

The verified classes and students endpoints are still legacy endpoints under `/api/*.php`.

A dedicated legacy `ApiClient` instance was added behind the existing centralized HTTP layer instead of placing raw fetch calls in React features.

Canonical and legacy clients share the same in-memory CSRF lifecycle so future protected legacy mutations do not create a second token contract.
## Files changed

- `frontend/src/features/classes/api.ts`
- `frontend/src/features/classes/types.ts`
- `frontend/src/features/classes/useTeacherClasses.ts`
- `frontend/src/features/students/api.ts`
- `frontend/src/features/students/types.ts`
- `frontend/src/features/students/useClassStudents.ts`
- `frontend/src/features/reports/api.ts`
- `frontend/src/features/reports/useMonthlyReport.ts`
- `frontend/src/pages/app/TeacherDashboardPage.tsx`
- `frontend/src/pages/app/TeacherStudentsPage.tsx`
- `frontend/src/pages/app/TeacherReportsPage.tsx`
- `frontend/src/pages/app/WorkspaceLandingPage.tsx`
- `frontend/src/routes/route-config.ts`
- `frontend/src/routes/router.tsx`
- `frontend/src/services/api/client.ts`
- i18n dictionary/types for teacher workflow copy

## State architecture

Server data is owned by feature hooks:

- `useTeacherClasses`
- `useClassStudents`
- `useMonthlyReport`

UI state remains local:

- student search query.

Navigational state lives in React Router search parameters:

- `class_id`
- `month`

No Redux, Zustand, global event bus, or browser database mirror was introduced.
## Verification

Static gates:

- TypeScript typecheck: PASS
- Oxlint: PASS — 0 warnings / 0 errors
- Vite production build: PASS
- `git diff --check`: PASS

Browser workflow evidence with synthetic fixtures:

- teacher session bootstrap: PASS
- teacher workspace rendering: PASS
- assigned class rendering: PASS
- dashboard → students navigation: PASS
- roster load: PASS
- student search/filter: PASS
- dashboard navigation recovery: PASS
- monthly report route with URL state: PASS
- monthly totals rendering: PASS
- per-student statistics rendering: PASS

No real school/student data was used.

## Issues found and fixes

1. Strict TypeScript rejected optional `AbortSignal` values passed as explicit `undefined`. Feature adapters now omit `signal` unless one exists.

2. TypeScript `erasableSyntaxOnly` rejected a constructor parameter property in the API client. The client now declares and assigns its field explicitly.

3. The canonical and legacy API clients originally had separate CSRF state. They now share one in-memory CSRF lifecycle.

4. A report stat-items array inferred a mixed union incompatible with the typed translation function. It is now explicitly typed as `[TranslationKey, number]`.

5. The current-month helper previously used UTC conversion. It now derives the month from local date fields to avoid month-boundary surprises.

## Gate

PASS.

Phase 10 establishes a real teacher workspace baseline without prematurely embedding attendance or signature business rules into the wrong phase.

The teacher workflow now has production-shaped feature boundaries and server-state ownership suitable for the deeper attendance work in Phase 11.

📍 Current project state: Official frontend Phases 1–10 accounted for; next = Phase 11 — Attendance Engineering.
