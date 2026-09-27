# Phase 4 — Teacher Attendance Backend

Date: 2026-09-27

## Goal

Move the verified teacher attendance workflow behind the canonical /api/v1 backend boundary while preserving the enrollment-aware, weekly school-register behavior already used by the legacy API.

## ECC execution gates

1. UNDERSTAND — inventory the existing attendance domain, database constraints, access rules, sign-off behavior, and legacy API.
2. PLAN — freeze the v1 HTTP contract and acceptance criteria before implementation.
3. RED — add integration coverage that proves the required behavior fails before the new backend workflow exists.
4. IMPLEMENT — introduce a thin controller and a service-owned attendance workflow; repositories remain responsible for SQL/PDO access.
5. GREEN — run unit/integration/HTTP/E2E verification and preserve the legacy compatibility surface.
6. REVIEW — inspect changed files, transaction boundaries, authorization, race-sensitive state, and API semantics.
7. VERIFY — rerun the complete phase gate on the final head.

## Backend contract for this phase

### GET /api/v1/classes/{class_id}/attendance?week_start=YYYY-MM-DD

- authenticated users only;
- class must be active and belong to the active academic year;
- teacher access is limited to assigned classes;
- admin/counselor read access follows the existing class authorization rule;
- supplied date is normalized to the Monday of its six-day school week;
- a partially overlapping week is clamped to the class academic-year boundaries; a fully out-of-year week returns an empty register;
- response contains the weekly range, active class roster, and enrollment-aware attendance rows.

### POST /api/v1/classes/{class_id}/attendance/bulk

- admin/teacher only;
- CSRF required;
- maximum 500 entries;
- each student must belong to the class and be active;
- dates must fall inside the class academic year;
- periods are 1–8;
- statuses are present, absent, late, excused;
- upsert and delete are supported;
- duplicate student/date/period keys inside one batch are rejected;
- signed lessons are read-only until reopened;
- all mutations, audit records, and sign-off invalidation happen in one transaction;
- a failure rolls back the whole batch;
- exact no-op updates do not create attendance/audit noise.

## Preservation rules

- student_enrollments remains authoritative for historical attendance.
- Attendance records keep both student_id and enrollment_id.
- The legacy api/attendance.php endpoint remains a compatibility path during the backend migration.
- No frontend rewrite is included in this phase.
- No schema change is planned unless a demonstrated backend requirement makes it necessary.

## Phase acceptance

RED must demonstrate missing canonical attendance workflow coverage before implementation.
GREEN requires:
- attendance workflow integration tests;
- existing PHP/unit/integration tests remain green;
- canonical v1 attendance HTTP smoke checks are protected correctly;
- critical E2E attendance flows remain green;
- the changed diff passes review with no release-blocking authorization, transaction, or enrollment-integrity issue.