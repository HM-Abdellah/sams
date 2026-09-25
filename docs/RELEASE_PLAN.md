# SAMS — Layered Completion Plan

This is the execution order for finishing the release candidate. The existing application architecture stays in place; layers describe delivery and verification order, not a forced rewrite.

## Layer 0 — Baseline / Freeze Scope

Goal: establish the exact release scope before final validation.

- Confirm current main branch and CI baseline.
- No new feature scope after the release freeze.
- Fixes are limited to correctness, security, validation, deployment, documentation, and release blockers.

Gate:
- Working tree/branch state known.
- Release scope frozen.

## Layer 1 — Teacher Attendance

Goal: make daily attendance reliable and fast for teachers.

- Load class roster and monthly attendance.
- 8 periods per day.
- Present / absent / late / excused / clear interactions.
- Optimistic UI updates.
- Debounced frontend batching through the bulk attendance API.
- Batch rollback on failed requests.
- Flush pending changes before class navigation, reload, and logout.
- Backend validates authorization, roster membership, academic-year dates, status, duplicate keys, transaction integrity, and audit logging.

Gate:
- One attendance burst produces one bulk request.
- Failed bulk save restores the previous local state.
- Backend bulk integration tests remain green.

## Layer 2 — Administration

Goal: complete the operational admin console.

- Classes: create / update / activate / deactivate.
- Students: create / update / deactivate / transfer with enrollment history preservation.
- Users: create / activate / deactivate / unlock / password reset.
- Teacher-class assignments.
- Academic-year creation and activation.
- Import staging, correction, revalidation, and final import.
- Audit activity visibility.

Gate:
- Every mutation has an API contract, authorization, CSRF protection, validation, transaction behavior where required, and audit coverage.
- UI reflects successful server state after each mutation.

## Layer 3 — Archive, Reports, and Signatures

Goal: verify that historical and reporting workflows are usable end-to-end.

- Daily archive.
- Monthly archive totals.
- Student history.
- Monthly attendance report.
- Official printable report.
- Class signature save / load / clear.
- Historical access remains independent from the active operational class state.

Gate:
- Historical records remain readable after class/year changes.
- Report totals match stored attendance.
- Signature workflow survives reload.

## Layer 4 — Security / Reliability

Goal: close release-blocking security and reliability issues.

- Authentication and session invalidation.
- Session version handling.
- Role isolation.
- CSRF protection.
- Prepared SQL / repository boundaries.
- Inactive-user restrictions.
- Upload size and row limits.
- Transaction rollback.
- Duplicate/conflicting mutations.
- Safe server-side errors.
- Security headers.
- No secrets or real school data in Git.

Gate:
- No known critical auth/integrity blocker.
- Security regression tests are green.

## Layer 5 — Playwright E2E

Goal: prove real user workflows instead of only endpoint behavior.

Required flows:

1. Unauthenticated access -> login.
2. Admin login -> dashboard.
3. Teacher login -> assigned class only.
4. Attendance marking -> correction -> bulk save.
5. Student creation -> edit -> deactivate.
6. User creation -> role/active state -> unlock/password reset.
7. Teacher assignment -> access changes.
8. Academic-year creation/activation -> operational class visibility.
9. CSV import -> staged errors -> correction -> revalidation -> import.
10. Archive/report/signature workflows.
11. Logout -> protected session becomes inaccessible.
12. Desktop and mobile smoke coverage.

Gate:
- Authenticated E2E runs without being skipped.
- Critical desktop and mobile workflows are green.

## Layer 6 — Clean-School Acceptance

Goal: validate the system from a fresh-school state.

Dataset:

- 1 admin.
- 1 counselor.
- 2 teachers.
- 2 active classes.
- Realistic student rosters.
- One active academic year.
- Separate presentation/test data from real records.

Scenario:

fresh install -> create admin -> configure school -> assign teachers -> import students -> mark attendance -> correct attendance -> sign sheet -> generate report -> inspect archive/history -> logout -> verify access control.

Gate:
- Scenario succeeds from a clean database.
- Historical attendance survives enrollment/class transitions.
- No manual database repair is required during the scenario.

## Layer 7 — Deployment and Documentation

Goal: make the release reproducible outside the developer machine.

- Fresh-install instructions.
- MariaDB/MySQL setup.
- PHP built-in server development instructions.
- Apache deployment notes.
- Migration instructions.
- Backup/export procedure.
- Secrets/configuration guidance.
- Test commands.
- Presentation/demo data isolation.

Gate:
- A new environment can be configured from the documented steps.
- CI remains green after documentation/deployment changes.

## Layer 8 — Final Review

Goal: review the completed system, not redesign it.

Review order:

1. Architecture and layer boundaries.
2. Database integrity.
3. API contract consistency.
4. Backend security.
5. Frontend state/data flow.
6. Attendance UX.
7. Admin workflows.
8. Archive/report correctness.
9. E2E coverage gaps.
10. Performance and maintainability.
11. Deployment readiness.
12. Known limitations and post-release backlog.

Gate:
- Only release-blocking fixes are applied.
- No architecture rewrite or unrelated feature expansion.

## Post-Release Backlog

These are explicitly outside the release gate:

- PDF/XLSX import adapters.
- Richer archive search.
- Timetable-aware defaults.
- Richer exports.
- PWA/offline support.
- Analytics.
- Expanded regression coverage.
- Further design-system refinement.
