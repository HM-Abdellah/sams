# SAMS — Phase 9 Clean-School Acceptance

Status: CLOSED

Branch: feat/phase-9-clean-school-acceptance

## UNDERSTAND

Phase 9 validates a genuine fresh-school lifecycle rather than another pre-seeded E2E suite.

Release gate requirements:

- clean database;
- first administrator creation;
- one active academic year;
- two active classes;
- one counselor and two teachers;
- teacher/class assignments;
- student import;
- attendance, correction, and signing;
- reporting;
- archive and student-history verification after transfer;
- logout and role-based access verification;
- no manual database repair.

The application architecture remains unchanged.

## PLAN

The acceptance journey uses the existing production UI and the existing first-admin CLI bootstrap. CI will rebuild the test database from database/schema.sql, create the first admin through scripts/create_admin.php, start the real PHP application, and execute one serial browser journey with synthetic data only.

The scenario deliberately avoids scripts/e2e_seed.php; that seed creates a preconfigured school and therefore cannot prove clean-school setup.

Synthetic identities:

- admin: admin
- counselor: counselor.phase9
- teachers: teacher.phase9.a and teacher.phase9.b
- classes: PH9-2BAC-A and PH9-2BAC-B
- academic year: 2026/2027
- attendance date: 2026-10-02
- transfer effective date: 2026-10-05

Student data is synthetic and test-only. The acceptance suite must never use the real school workbook or any real student records.

## TEST / RED

Initial release-blocking assertions:

1. After first-admin creation and login, the operational class list is empty.
2. All school configuration is performed through the UI after that bootstrap.
3. Student import goes through stage -> correct -> revalidate -> import with an intentionally invalid fixture.
4. Manual student create -> update -> deactivate is exercised.
5. Attendance is persisted through the real backend, then signed, reopened, corrected, re-saved, and week-signed.
6. Printable weekly report is populated from stored state.
7. A student with historical attendance is transferred to the second class; the source archive and student history still expose that attendance.
8. Teacher A sees only Class A and not the transferred student; Teacher B sees Class B and the transferred student.
9. Counselor sees both operational classes but no admin/archive controls; authenticated archive access is rejected with HTTP 403.
10. Logout leaves the protected dashboard inaccessible.

## Final implementation

The clean-school acceptance workflow is wired into CI and runs from a database rebuilt from `database/schema.sql`, followed by first-admin creation through `scripts/create_admin.php`. The browser journey uses only synthetic data and the production UI; no manual database repair is performed.

The final functional validation run was Run #711 on the exact commit `487fb57463d32a9e552b9b741755855f40912b66`. It passed:

- clean-school browser acceptance;
- persisted-state verification;
- PHP regression suite;
- JavaScript syntax check;
- the existing Playwright E2E suite.

The clean-school acceptance itself completed with 1 passed test and no skipped/focused tests or `waitForTimeout` usage.

## Evidence

- Functional validation Run #711: `36441910211`.
- Exact functional-validation commit: `487fb57463d32a9e552b9b741755855f40912b66`.
- Clean-school browser acceptance: PASS.
- Persisted clean-school state verification: PASS.
- PHP regression suite: PASS.
- JavaScript syntax check: PASS.
- Playwright E2E suite: PASS.
- No skipped/focused tests and no `waitForTimeout` in the Phase 9 acceptance test.
- No manual database mutation inside the browser journey.

## Gate

CLOSED. The complete clean-school scenario passes from a database rebuilt from `database/schema.sql`; the first administrator is created through the real `scripts/create_admin.php` path; historical attendance survives transfer and remains visible through archive/history; role isolation and logout are verified; persisted database state matches the expected scenario; and no manual database repair is required.

No release merge is part of this phase.
