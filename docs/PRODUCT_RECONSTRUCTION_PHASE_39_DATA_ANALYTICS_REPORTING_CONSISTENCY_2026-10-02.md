# SAMS — Phase 39 Data + Analytics + Reporting Consistency

Date: 2026-10-02
Status: **Closed**
Branch: `reconstruction/phase-39-data-analytics-reporting-2026-10-02`

## Goal

Establish one server-authoritative semantic contract for attendance metrics across:

- Admin Dashboard
- Teacher Monthly Reports
- Admin Historical Archive

The phase is intentionally conservative: it standardizes interpretation of existing persisted attendance data without inventing a timetable, scheduled-session denominator, calendar, alert model, or new export contract.

## Explore

The existing surfaces exposed the same attendance facts through different layers:

- Admin dashboard repository code calculated some rates directly.
- The dashboard frontend also recalculated class presence rates locally.
- Teacher monthly reports derived aggregate totals with a client-side `useMemo`.
- Historical archive exposed attendance counts but did not expose the same presence-rate contract.
- Repository field names differ by scope (`record_count`, `today_records`, `recorded_count`), making a blind shared-field assumption unsafe.
- The existing attendance model is period/record based and enrollment-aware; the schema does not provide an authoritative timetable or expected-session table.

## Research

### 1. Education attendance data quality

NCES/IES documentation emphasizes consistent definitions, data quality checks, and explicit business rules when collecting and reporting education data. The principle applied here is that a metric must have one explicit definition and the same definition must be used across reports.

Source: U.S. Department of Education / NCES / IES, *Forum Guide to Collecting and Using Attendance Data* (attendance data collection and reporting guidance).

### 2. Attendance systems expose institution-specific denominators

PowerSchool's current Attendance Reports documentation explicitly advises administrators to understand how their school calculates attendance before producing attendance reports. openSIS likewise documents multiple attendance/reporting constructs, including days possible, attendance possible, present, absent, other codes, not taken, and percentages that can depend on the institution's configuration.

This is evidence against silently converting SAMS's current period records into a scheduled-lesson denominator.

Sources:
- PowerSchool SIS Attendance Reports: https://ps.powerschool-docs.com/pssis-admin/latest/attendance-reports
- openSIS Attendance terms: https://help.opensis.com/portal/en/kb/articles/attendance-terms
- openSIS Average Attendance Reports: https://help.opensis.com/portal/en/kb/articles/generate-average-attendance-reports

### 3. Reporting workflows benefit from explicit aggregates and drill-downs

openSIS documents report patterns that combine aggregated counts with student-level and date/period-level detail. This supports keeping both summary metrics and enrollment-aware detail in SAMS rather than replacing one with the other.

Sources:
- https://help.opensis.com/portal/en/kb/articles/generate-attendance-report-by-day
- https://help.opensis.com/portal/en/kb/articles/generate-attendance-reports-by-course
- https://help.opensis.com/portal/en/kb/articles/generate-student-monthly-attendance-register

### 4. Charts need textual equivalents

W3C WAI guidance treats charts as complex information and recommends a textual representation of the essential data/trend. SAMS already has chart descriptions/captions on the admin attendance trend; Phase 39 preserves that behavior.

Source: W3C Web Accessibility Initiative, *Complex Images*: https://www.w3.org/WAI/tutorials/images/complex/

## Decide

### Canonical metric

`presence_rate = present_count / recorded_count * 100`

where:

- `recorded_count` is the number of persisted attendance entries in the requested scope.
- `present_count` counts entries whose status is `present`.
- `absent_count`, `late_count`, and `excused_count` remain independent status counts.
- The result is rounded to one decimal place.
- When no attendance entries exist, the result is `null`, not `0`.

### Explicit non-goals

Phase 39 does **not** introduce:

- scheduled lesson counts;
- days possible;
- instructional minutes;
- attendance completeness;
- school-calendar inference;
- automatic absence-risk scoring;
- a new export format.

Those require separate product/data contracts and should not be approximated from the current attendance rows.

### Architecture decision

Arithmetic moves behind `SAMS\\Helpers\\AttendanceMetrics`, while repositories remain responsible for retrieving raw aggregates. Services normalize repository-specific denominator field names before passing them to the shared helper.

The frontend consumes server-provided metric fields and does not recompute business semantics.

## Construct

### Backend

Added:

- `backend/src/Helpers/AttendanceMetrics.php`
- `backend/tests/Unit/AttendanceMetricsTest.php`

Updated:

- `backend/src/Services/AdminDashboardService.php`
- `backend/src/Repositories/AdminDashboardRepository.php`
- `backend/src/Services/ReportService.php`
- `backend/src/Services/ArchiveService.php`

### Frontend

Updated:

- `frontend/src/features/admin/types.ts`
- `frontend/src/features/reports/api.ts`
- `frontend/src/features/archive/types.ts`
- `frontend/src/features/i18n/types.ts`
- `frontend/src/features/i18n/dictionary.ts`
- `frontend/src/pages/app/AdminDashboardPage.tsx`
- `frontend/src/pages/app/TeacherReportsPage.tsx`
- `frontend/src/pages/app/AdminArchivePage.tsx`

The UI explicitly explains the denominator and displays `—` when no records exist.

### Regression coverage

Added:

- `tests/phase39_data_analytics_reporting_integration.php`

This verifies that dashboard summary, dashboard trend, class statistics, teacher report, archive month, and archive day expose the same metric semantics over the same persisted attendance data, including a zero-record scope.

Updated fixtures and assertions:

- `tests/e2e/frontend_phase14_admin_platform.spec.js`
- `tests/e2e/frontend_phase15_archive_reports_signatures.spec.js`

## Verify

### Completed local verification

Frontend:

- TypeScript typecheck: **PASS**
- oxlint: **PASS**
- Unit tests: **15 files / 58 tests PASS**
- Production build: **PASS**
- Targeted browser regression: **3/3 PASS**

New backend metric unit test:

- **3 tests / 4 assertions PASS**

### Local environment limitation

The Codespace PHP CLI currently lacks `pdo_mysql` and `ZipArchive`. Therefore:

- the new DB integration cannot be executed locally in this environment;
- the full backend PHPUnit suite currently errors in 14 PhpSpreadsheet tests because `ZipArchive` is unavailable.

This is treated as an environment limitation, not as evidence of a failing Phase 39 implementation. The dedicated CI installs the required PHP extensions and runs the real MariaDB integration successfully.

### Dedicated CI

Added:

- `.github/workflows/phase39-analytics-reporting.yml`

Dedicated run for commit `3768197202f57281afb16eb21a0dbc1e5a725b6c`: GitHub Actions run **#8** completed successfully. Both backend and frontend jobs passed every defined step.

The workflow verifies:

Backend:
- PHP syntax
- full PHPUnit suite with GD/MySQL/XML/Zip extensions
- existing administration regression
- real MariaDB Phase 39 integration

Frontend:
- typecheck
- lint
- unit tests
- production build
- Chromium E2E for Admin Dashboard, Admin Archive, and Teacher Monthly Report

## Demo stability implications

Phase 39 is treated as a data-consistency phase first, not a cosmetic analytics phase. The demo should never show two different interpretations of the same attendance data depending on which screen the administrator opens.

For the final demo track, the critical expectation is:

**same data → same definition → same number**

with explicit `null`/no-data behavior and drill-down detail available where relevant.

## Git-check

Before merge:

1. `git diff --check`
2. PHP lint for changed backend files
3. frontend typecheck/lint/unit/build
4. targeted browser regression
5. dedicated GitHub Actions verification
6. inspect final diff and changed-file scope
7. verify no secrets/config credentials are committed

## Exit criteria

Phase 39 can close only when:

- dedicated backend CI passes;
- dedicated frontend CI passes;
- dashboard/report/archive metric semantics match;
- no unintended client-side business-metric recomputation remains;
- documentation and API contract match implementation;
- final diff is clean and limited to Phase 39 scope.

## Current exit status

**CLOSED — shared metric semantics implemented, documented, covered by unit/integration/E2E verification, and confirmed by dedicated remote Backend + Frontend CI.**
