# FRONTEND PHASE 11 — ATTENDANCE ENGINEERING

## Objective

Build the real teacher attendance workflow on top of the canonical backend contract without inventing attendance business rules or preserving obsolete legacy UI.

## Implemented

- Canonical weekly attendance loading through `GET /api/v1/classes/{class_id}/attendance?week_start=YYYY-MM-DD`.
- Typed bulk attendance mutations through `POST /api/v1/classes/{class_id}/attendance/bulk`.
- Class selection and URL-persisted class/week context.
- Monday-normalized six-day week navigation.
- Day and period selection for the eight legacy-defined periods.
- Status editing: `present`, `absent`, `late`, `excused`, `clear`.
- Search and weekly absence filters, including the existing eight-absence threshold.
- Desktop table interaction and mobile card interaction with task-adapted layouts.
- Local typed draft overlay with server-confirmed state as the source of truth.
- 500ms debounced bulk save matching the proven legacy batching behavior.
- Explicit dirty, saving, saved, and failed mutation feedback.
- Manual Save Now action.
- Flush-before-context-change behavior for week/class navigation.
- Server-provided period sign-off state in the canonical weekly response.
- Signed lesson protection in the UI.
- Failed bulk-save rollback to the last server-confirmed state.
- Preservation of pending drafts when save succeeds but authoritative refresh fails, avoiding a false rollback to stale data.
- French, Arabic, and English attendance copy through the existing i18n architecture.

## Minimal Backend Contract Gap

The canonical weekly attendance endpoint previously returned attendance rows without the weekly period sign-off state required by the frontend to represent protected lessons from the server contract.

Minimal change:

- Add `period_signoffs` to the weekly attendance response.
- Return an empty array for a fully out-of-year register.
- Keep sign/reopen mutations out of Phase 11; signature workflow remains a later product phase.

No attendance authorization or business-rule logic was moved into React.

## Files Changed

- `backend/src/Services/TeacherAttendanceService.php`
- `docs/API_CONTRACT.md`
- `frontend/src/features/attendance/api.ts`
- `frontend/src/features/attendance/types.ts`
- `frontend/src/features/attendance/useAttendanceRegister.ts`
- `frontend/src/features/i18n/dictionary.ts`
- `frontend/src/features/i18n/types.ts`
- `frontend/src/pages/app/TeacherAttendancePage.tsx`
- `tests/e2e/frontend_phase12_attendance_reliability.spec.js`

## Verification

### Frontend static gates

- TypeScript: PASS
- oxlint: PASS — 0 warnings / 0 errors
- Vite production build: PASS
- `git diff --check`: PASS

### Browser E2E

`tests/e2e/frontend_phase12_attendance_reliability.spec.js`

The initial 6-test Phase 11 suite was expanded into the 12-test Phase 12 reliability gate. See `FRONTEND_PHASE_12_ATTENDANCE_RELIABILITY.md` for the complete reliability coverage.

### Backend syntax

- `TeacherAttendanceService.php`: PASS
- `AttendanceSignoffRepository.php`: PASS
- `attendance_backend_integration.php`: PASS syntax check

## Environment Limitation

The backend attendance integration script was not executable in this Codespace because the PHP CLI lacks the `pdo_mysql` extension.

The complete backend PHPUnit suite also reports 14 unrelated environment errors because the PHP CLI lacks `ZipArchive`; the failing tests are workbook-import tests, not attendance tests.

These limitations were not represented as passing backend runtime evidence.

## Gate

# PASS

Phase 11 core attendance engineering is implemented and verified from the frontend boundary. Backend runtime integration remains an environment prerequisite because the current PHP CLI is missing `pdo_mysql`.

## Current Project State

- Phase 1 — 10: CLOSED
- Phase 11 — Attendance Engineering: CLOSED
- Phase 12 — Attendance Reliability: CLOSED
- Phase 13 — Students / Classes: NEXT
