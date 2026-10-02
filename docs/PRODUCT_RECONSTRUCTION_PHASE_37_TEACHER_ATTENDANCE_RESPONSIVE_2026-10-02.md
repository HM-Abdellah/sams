# SAMS — Product Reconstruction Phase 37

## Phase

**Phase 37 — Teacher Attendance Responsive Reconstruction**

**Status:** CLOSED (local implementation and verification complete; remote CI closeout pending)

## Goal

Reconstruct the high-frequency teacher attendance workflow for narrow screens without changing the backend attendance contract or weakening the existing reliability guarantees.

The phase is intentionally implementation-led: the desktop attendance register remains intact, while the mobile experience is redesigned around one attendance period at a time so a teacher can mark a roster without operating a wide horizontal table.

## Evidence and research inputs

The product decision was cross-checked against established school-information-system attendance workflows:

- openSIS documents class → attendance as a daily teacher workflow with date navigation and predefined attendance statuses.
- PowerSchool documents period-aware attendance for class sections and distinguishes attendance submission state.
- OpenEMIS documents a mobile flow built around class/day filtering, direct status marking, and auto-save.

These sources informed the decision to make the active period explicit on mobile rather than relying on a wide grid as the primary interaction surface.

## Backend contract audit

No new backend endpoint, database table, attendance status, or persistence model was introduced.

The implementation continues to use the existing class-scoped attendance register and bulk-save contracts through `useAttendanceRegister`. The existing client behavior remains authoritative for:

- batched writes;
- server-confirmed refresh after writes;
- retry after failed writes;
- protection against navigation/reload/logout while attendance work is pending;
- signed-lesson protection.

## Implementation

### Mobile attendance workspace

`frontend/src/pages/app/TeacherAttendancePage.tsx` now provides a mobile-only period selector for all eight configured periods. Each period exposes its time range and current completion state, and `aria-pressed` identifies the active period.

The mobile roster renders one student row at a time for the selected period. The row exposes the student's name, absence count, current status, accessible status label, and a touch-sized status control.

The desktop experience keeps the existing period-by-period table with the morning/afternoon grouping and per-period signoff controls.

### Responsive hardening

The attendance day selector and period selector now opt into `min-w-0`/`max-w-full` constraints so horizontal scrolling is contained inside the intended controls instead of expanding the document viewport on narrow devices.

The week navigation control was also made wrapping/flexible at narrow widths so the attendance toolbar remains inside a 320px viewport.

### Test robustness

The existing attendance reliability and responsive tests were updated to target the visible responsive representation rather than assuming the desktop table is present at mobile widths. Semantic/data attributes were added only as test hooks and do not alter application behavior.

The accessibility regression test was likewise narrowed to visible buttons when checking touch-target dimensions, because both desktop and mobile markup remain mounted while CSS determines which representation is displayed.

## Files changed

- `frontend/src/pages/app/TeacherAttendancePage.tsx`
- `tests/e2e/frontend_phase12_attendance_reliability.spec.js`
- `tests/e2e/frontend_phase17_responsive.mobile.spec.js`
- `tests/e2e/frontend_phase18_accessibility.spec.js`
- `tests/e2e/frontend_phase37_teacher_attendance_responsive.spec.js`
- this phase document
- `docs/PRODUCT_RECONSTRUCTION_ROADMAP_2026-10-01.md`

## Verification

Local verification completed successfully:

- TypeScript typecheck: PASS
- Oxlint: PASS, 0 warnings / 0 errors
- Production frontend build: PASS, 182 modules transformed
- Vitest: PASS, 15 files / 54 tests
- Phase 37 dedicated E2E: PASS, 2 / 2
- Cross-phase teacher attendance / students / accessibility / workspace regression: PASS, 31 / 31

The 31-test regression bundle covered Phase 12 attendance reliability, Phase 13 students/classes, Phase 17 responsive engineering, Phase 18 accessibility, Phase 36 teacher workspaces, and Phase 37.

`git diff --check`: PASS.

## Security and data integrity impact

No authorization boundary was relaxed. No attendance record is inferred client-side as authoritative. Mobile marking still passes the selected class, date, and period through the existing typed bulk API and waits for server confirmation before clearing the pending draft state.

Signed periods remain non-editable in the UI through the existing server-backed signoff state.

## Accessibility and responsive impact

The mobile period selector exposes the active period through `aria-pressed`. Status controls have accessible labels that include the student, period, and current status. The existing global focus-visible treatment remains in effect.

The narrow-screen workflow was verified at 320px/390px layouts and the desktop table remains covered at desktop breakpoints.

## Known limitations

The phase does not introduce a timetable, notifications, recent activity feed, or calendar because the current backend contract does not expose those data sources. Those remain separate future scope.

The mobile roster intentionally focuses on one period at a time; teachers who need a simultaneous multi-period overview continue to use the desktop table.

## Closeout

Phase 37 can be marked fully closed after the implementation commit is pushed and the required GitHub Actions gates are green. No product change should be promoted to an administrative demo candidate until that CI closeout is verified.
