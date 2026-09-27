# Phase 6 — Archive, Reports, and Signatures

Date: 2026-09-27

## Goal

Move historical archive, attendance reporting, and class-signature workflows behind the canonical /api/v1 backend boundary without changing the legacy public PHP endpoints.

## Scope

- Historical archive: days, month, day, and student history.
- Monthly enrollment-aware attendance report.
- Teacher/admin class signature read, save, and clear.
- Thin v1 controllers with domain services and repository-owned SQL.
- Preserve the existing legacy endpoints as compatibility surfaces.
- Preserve the existing client-side official printable weekly/monthly report presentation; no visual rewrite in this phase.
- No real school/PII fixtures.

## Canonical v1 routes

### GET /api/v1/admin/archive
Admin only. Query: view=days|month|day|student, class_id, and view-specific month, date, or student_id.

### GET /api/v1/classes/{id}/report
Authenticated users with operational access to the class. Query: month=YYYY-MM. Returns enrollment-aware monthly student totals.

### GET /api/v1/classes/{id}/signature
Authenticated users who can access the class. Returns the current user's saved signature for that class.

### POST /api/v1/classes/{id}/signature
Admin or teacher with class access. CSRF required. Body: signature_data PNG data URL.

### DELETE /api/v1/classes/{id}/signature
Admin or teacher with class access. CSRF required.

## Behavioral preservation

- Archive remains read-only and separate from operational class access.
- Historical class access is resolved from class existence/administrative history rules, not only active-year visibility.
- Report totals use the student's enrollment interval when joining attendance.
- Signature persistence remains one signature per teacher/class pair.
- Successful signature mutations are transactional and audited.
- Existing error semantics remain: 401/403/404/405/409/419/422/500 as applicable.
## ECC gates

1. UNDERSTAND — inspect current legacy endpoints, repositories, schema, frontend consumers, authentication, and existing E2E coverage.
2. PLAN — freeze the v1 route contract and acceptance criteria in this document before implementation.
3. RED — add synthetic integration tests for archive/report/signature workflows and prove the canonical services/controllers are absent before implementation.
4. IMPLEMENT — add domain services/controllers and repository boundaries; keep legacy endpoints untouched except for deliberate shared-service reuse where safe.
5. GREEN — pass synthetic MariaDB integration, authenticated HTTP smoke, existing regression, PHPUnit, JavaScript syntax, and Playwright E2E.
6. REVIEW — verify historical access, enrollment boundaries, report arithmetic, signature validation/CSRF, audit coverage, transaction rollback, and sensitive-field exposure.
7. VERIFY — final CI, diff review, clean working tree, temporary infrastructure removal, and Phase 6 sign-off.

## Acceptance criteria

### Archive

- Unauthenticated archive requests are rejected.
- Counselor/teacher access is rejected by the canonical admin archive route.
- Admin can read historical active and inactive classes.
- days returns recorded attendance days for the selected month.
- month returns one enrollment-aware row per student enrollment overlapping the month.
- day rejects malformed and out-of-academic-year dates.
- student rejects a student that was never enrolled in the selected historical class.
- Historical reads remain available after the class/year is no longer operational.

### Reports

- Authenticated teacher/admin can read a report only for a class they can currently access.
- Counselor access follows the legacy operational contract.
- Invalid month/class inputs return 422.
- Attendance totals are derived from stored rows and enrollment intervals, with no cross-enrollment leakage.
- The report contains no password hash or unrelated authentication secrets.

### Signatures

- GET respects class access and returns the current user's signature only.
- POST/DELETE require admin-or-teacher authorization and CSRF.
- Invalid/non-PNG/oversized payloads return 422.
- Save is idempotent; re-saving updates the same teacher/class record.
- Clear is idempotent and reports whether a row changed.
- Successful save/clear operations are atomic and audited.
- Failed mutation leaves the prior signature intact.
## Non-goals

- React migration.
- Rebuilding the report UI or print CSS.
- New database tables unless an uncovered integrity requirement proves one necessary.
- Changing the legacy endpoint contract for external callers.
- PDF/XLSX export generation.

## Exit gate

Phase 6 closes only when the canonical routes, integration tests, HTTP smoke, regression suite, and CI are green, and the branch contains no temporary acceptance data or infrastructure.
