# SAMS — Product Reconstruction Phase 36

Status: CLOSED after final verification head `bf0592d164b42393ec785d82ad74227427290a07` passed GitHub Actions run #979.

## 1. Goal

Center the teacher experience on a class-first workflow:

Teacher Home → My Classes → Class Workspace → Attendance / Students / Reports / Signatures.

The phase improves access to real teacher work without creating unsupported scheduling, alert, notification, or activity data.

## 2. Evidence and backend contract audit

Existing authoritative teacher contracts were inspected before implementation:

- `backend/src/Repositories/ClassRepository.php`
  - teachers receive only active classes assigned through `teacher_classes`
  - class access is school-scoped and assignment-scoped
  - historical access is handled separately
- `backend/src/Repositories/TeacherClassRepository.php`
  - teacher/class assignment persistence and lookup
- `api/classes.php`
  - real teacher class listing contract
- `api/students.php`
  - class access enforcement plus class-scoped student roster and mutations
- `api/attendance.php`
  - class-scoped attendance read/write and role enforcement
- `api/attendance-signoffs.php`
  - class-scoped lesson/week signing workflow
- existing frontend report/signature routes and hooks
  - `/app/reports`
  - `/app/signatures`

Database inspection found useful class/attendance/assignment/audit structures, but no dedicated teacher timetable/schedule, notification/alert, or recent-activity contract that could safely drive a populated dashboard.

Decision: do not simulate Today's Classes, Alerts, Recent Activity, messages, or calendar data. The teacher home uses deterministic class-centered entry points backed by the real assigned-class response.

## 3. Research inputs

### openSIS

The teacher portal pattern reviewed for this phase puts assigned classes, attendance, student records, reports, and other teacher work behind a role-specific workspace. Its teacher dashboard also surfaces contextual shortcuts and class information.

References:
- https://help.opensis.com/portal/en/kb/articles/navigation-through-teacher-portal-dashboard
- https://help.opensis.com/portal/en/kb/articles/view-students-in-a-class-students-tab-opensis
- https://help.opensis.com/portal/en/kb/articles/portals
- https://help.opensis.com/portal/en/kb/articles/understanding-opensis-navigation

### PowerSchool

PowerSchool's teacher start experience was used as a reference for class-oriented shortcuts and rapid access into attendance, student information, and reporting workflows.

Reference:
- https://ps.powerschool-docs.com/pssis-teacher/latest/get-started

### WAI-ARIA

Existing SAMS accessible dialog and focus patterns remain the authority for this phase. The new workspace links use persistent focus-visible states and normal navigation semantics.

References:
- https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/

## 4. Implemented slices

### 4.1 Teacher Home

Updated `frontend/src/pages/app/TeacherDashboardPage.tsx`.

Added three class-centered quick-access cards:

- My Classes: count of server-returned assigned classes
- Attendance: opens attendance with the first assigned class in URL context
- Students: opens students with the first assigned class in URL context

The first-class shortcuts are explicitly treated as deterministic entry points, not as "today's class".

Existing class cards remain available with per-class Attendance and Students actions.

### 4.2 My Classes

`frontend/src/pages/app/TeacherClassesPage.tsx` was retained as the existing server-backed class directory because it already exposed:

- class name
- level and branch
- academic year and date range
- Class Workspace entry
- Students entry
- Attendance entry

No redundant filtering or invented metadata was added.

### 4.3 Class Workspace

Updated `frontend/src/pages/app/TeacherClassDetailsPage.tsx`.

The workspace now gives one coherent class context with:

- class identity
- level and branch
- academic year and range
- class roster count
- student preview backed by `useClassStudents`
- direct, class-context-preserving links to Attendance, Students, Signatures, and Reports
- return path to My Classes

The roster preview remains intentionally bounded to avoid turning the class summary into a second full Students application; the full roster remains in the existing Students workspace.

No new API or data model was introduced.

## 5. Regression coverage

Added:

`tests/e2e/frontend_phase36_teacher_workspaces.spec.js`

Coverage:

1. Teacher Home exposes class-centered entry points and does not depend on unsupported daily dashboard data.
2. My Classes exposes server-backed class context and opens the selected Class Workspace.
3. Class Workspace preserves the selected class ID across Attendance, Students, Signatures, and Reports links.

The test suite uses deterministic mock responses that match the existing public frontend contracts.

Phase 22 and Phase 19 smoke/security selectors were also hardened after the first CI run exposed strict-mode collisions introduced by the new class-centered content. The application behavior was unchanged; only brittle text-only assertions were replaced with semantic/targeted selectors.

## 6. Verification

Local verification on the implementation tree:

- TypeScript: PASS
- Oxlint: PASS — 0 warnings / 0 errors
- Production frontend build: PASS — 182 modules
- Vitest: PASS — 15 files / 54 tests
- Phase 36 teacher workspace E2E: PASS — 3/3
- Regression E2E bundle: PASS — 17/17
  - Phase 13 students/classes: 3/3
  - Phase 17 responsive/mobile: 4/4
  - Phase 18 accessibility: 7/7
  - Phase 36 teacher workspaces: 3/3
- `git diff --check`: PASS

Regression E2E bundle was run with both Chromium and mobile projects where applicable.

## 7. Security and data integrity

No backend authorization logic was changed.

Teacher class visibility continues to come from the server's assignment- and school-scoped class query.

All class-specific links preserve the class ID in the existing query-string contract, allowing downstream pages to apply their existing server-authoritative access checks.

No client-side class membership or student visibility rule was introduced.

No fake schedule, alert, notification, messaging, or activity records were introduced.

## 8. UX and responsive decisions

The implementation follows the existing SAMS design tokens and shared UI primitives.

Focus-visible states were kept on the new dashboard/workspace links.

Touch targets use the existing `min-h-10`/`min-h-11` action sizing conventions.

The responsive layout uses grid breakpoints already present in the application, while the existing Students and Attendance pages retain responsibility for their own dense-table/mobile workflows.

No animation dependency or large visual effect was added for a workflow that is primarily navigational.

## 9. Known limitations

The backend currently does not expose a dedicated timetable/schedule contract for a factual "Today" section.

The backend currently does not expose dedicated teacher alert/notification/recent-activity contracts for a factual dashboard feed.

Those gaps remain explicit future scope. Filling them with static or inferred values would reduce data trustworthiness.

Attendance remains the next dedicated reconstruction phase because its high-frequency interaction model is substantially denser than the class-navigation work completed here.

## 10. Exact implementation head

`bf0592d164b42393ec785d82ad74227427290a07`

GitHub Actions run #979 passed all seven required remote verification gates for this phase.

## 11. Exit status

Phase 36 is CLOSED.

Next phase:
Phase 37 — Teacher Attendance Responsive Reconstruction.

Phase 37 will focus on rapid, safe attendance entry across desktop and mobile, while reusing the class context and attendance contracts established here.
