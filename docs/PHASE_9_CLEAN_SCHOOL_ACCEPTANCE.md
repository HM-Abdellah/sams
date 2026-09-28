# SAMS — Phase 9 Clean-School Acceptance

Status: IN PROGRESS

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

## Current implementation

The first acceptance test and a dedicated synthetic Class B CSV fixture are added on this branch.

The acceptance workflow itself is intentionally not yet wired into CI. That is the next implementation step so the first full run can act as the RED/GREEN discovery gate on a genuinely clean database.

## Evidence expected

- exact commit SHA;
- clean-school acceptance result;
- PHP regression result;
- JavaScript syntax result;
- Playwright result;
- no skipped/focused tests;
- no waitForTimeout;
- no manual database mutation inside the browser journey.

## Gate

CLOSED only when the complete clean-school scenario passes from a database rebuilt from database/schema.sql, the first admin is created through the real scripts/create_admin.php path, historical attendance survives transfer, and no manual database repair is required.

No release merge is part of this phase.
