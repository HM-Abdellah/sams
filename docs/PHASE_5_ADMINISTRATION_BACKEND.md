# Phase 5 — Administration Backend

Date: 2026-09-27

## Goal

Move the existing administration capabilities behind the canonical /api/v1 backend boundary while preserving current business rules and keeping the legacy admin endpoints available as compatibility paths.

## Scope

- Academic-year administration: list, create, activate.
- Class administration: list, create, update, activate/deactivate.
- User administration: list, create, update, password reset, unlock.
- Teacher administration: teacher directory, subjects, teaching assignments, subject create/update.
- Teacher/class administration: list assignments, assign, unassign.
- Admin dashboard read model.
- Admin audit-log read model.
- Authentication and authorization remain centralized in the existing Auth/Security helpers.
- Mutating operations require CSRF and remain transactional + audited.
- No React migration in this phase.
- No real school/PII fixtures.

## ECC gates

1. UNDERSTAND — inspect legacy admin endpoints, services, repositories, schema, access controls, and E2E expectations.
2. PLAN — freeze the canonical v1 routes and acceptance criteria in this document.
3. RED — add an integration suite for the administration workflow and prove the canonical admin service is absent before implementation.
4. IMPLEMENT — move business operations into domain services with thin controllers; repositories remain SQL/PDO boundaries.
5. GREEN — run synthetic MariaDB integration, HTTP smoke tests, PHPUnit, JavaScript syntax, and Playwright E2E.
6. REVIEW — audit authorization, CSRF, transactional boundaries, last-admin protection, academic-year activation, uniqueness/conflict handling, audit coverage, and PII exposure.
7. VERIFY — final CI and cleanup; close Phase 5 only after every gate is evidenced.

## Canonical v1 routes

### GET /api/v1/admin/dashboard
Admin only. Read-only dashboard summary, class statistics, attention students, classes without today's attendance, and recent audit activity.

### GET /api/v1/admin/audit
Admin only. Read-only paginated audit search using the existing filters.

### GET /api/v1/admin/academic-years
Admin and counselor may read.

### POST /api/v1/admin/academic-years
Admin only. Actions: create, activate. CSRF required.

### GET /api/v1/admin/classes
Admin only for administration view, returning historical/inactive classes as allowed by the existing admin contract.

### POST /api/v1/admin/classes
Admin only. Actions: create, update, activate, deactivate. CSRF required.

### GET /api/v1/admin/users
Admin only.

### POST /api/v1/admin/users
Admin only. Actions: create, update, reset_password, unlock. CSRF required.

### GET /api/v1/admin/teachers
Admin only. Returns teachers, active subjects, current active-class teaching assignments, and online window.

### POST /api/v1/admin/teachers
Admin only. Actions: assign, unassign, create_subject, update_subject. CSRF required.

### GET /api/v1/admin/teacher-classes
Admin only. Query with class_id or teacher_id.

### POST /api/v1/admin/teacher-classes
Admin only. Assign a teacher to an active class.

### DELETE /api/v1/admin/teacher-classes
Admin only. Remove a teacher-class assignment.

## Acceptance criteria

- Admin-only mutation/read surfaces reject unauthenticated and unauthorized users with the established API semantics.
- Counselor retains read access only where the legacy contract already grants it (academic years).
- Every mutation validates its inputs server-side.
- Duplicate class/user/employee/subject assignment conflicts return controlled 409 responses.
- At least one active administrator can never be removed by role change/deactivation.
- An administrator cannot deactivate their own account.
- Academic-year creation rejects invalid ranges and overlapping years; activation leaves one active year.
- Class operations preserve academic-year uniqueness and audit changes.
- Teacher assignment creates class-level access as required by the existing behavior.
- User password reset/unlock changes session_version and is audited.
- All successful persistent mutations are transactional and audited.
- Audit endpoints never expose passwords or password hashes.
- Dashboard and teacher endpoints do not expose password hashes.
- Existing legacy endpoints remain untouched as compatibility surfaces.

## Final verification evidence

### RED
- The canonical administration services were absent before implementation; the Phase 5 integration suite failed at the first missing service as expected.
- The RED fixture was kept synthetic and contains no real school data.

### GREEN
- Administration integration passed against isolated synthetic MariaDB fixtures.
- Verified academic-year list/create/activate and overlap protection.
- Verified class list/create/update/activation/deactivation, duplicate protection, and atomic rollback.
- Verified user list/create/update/password reset/unlock, session-version invalidation, duplicate protection, self-deactivation protection, and last-active-admin protection.
- Verified teacher directory, subject create/update, teaching assignment idempotence/conflict handling, and automatic class-level access preservation.
- Verified teacher-class assignment/list/unassignment idempotence.
- Verified dashboard summary/absence attention data and absence of Massar codes in the response.
- Verified audit search and mutation audit coverage.
- Authenticated v1 admin HTTP smoke passed for dashboard/classes/users/teachers/academic-years/audit.
- Admin mutation without CSRF was rejected with 419; authenticated class creation returned 201.
- Counselor academic-year read remained 200 while admin-class access remained 403.
- User and teacher administration responses did not expose password hashes.
- Existing attendance and school-import regression tests remained green.

### VERIFY
- Final CI run #563 passed PHP, JavaScript, and Playwright E2E.
- In #563, the PHP job passed lint, legacy service tests, backend unit tests, migration verification, MariaDB integration, school-import integration, attendance integration, administration integration, and API HTTP smoke.
- No real school/PII data was used in Phase 5.
- Phase 5 temporary database/test infrastructure was removed from the Codespace after verification.
- The legacy administration endpoints remain available as compatibility paths.
- React/frontend work is intentionally deferred to the later frontend phase.

### Phase 5 status

🏁 Administration Backend — CLOSED after final verification and cleanup.
