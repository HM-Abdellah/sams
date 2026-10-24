# SAMS — remaining steps to school handoff (2026-10-23)

## Current delivery model

SAMS v1 is an independently installed local school system: each school owns its own XAMPP/PHP and database instance. The teacher PWA/offline work is validated as its own workflow. Central cloud hosting, SaaS, and premature multi-tenancy are out of scope until the local installation is proven in school use.

The existing product reconstruction phases 30–39 and earlier deployment/security work are historical checkpoints; this plan is the current release-blocker list for the modified working tree, not a claim that every old phase document describes today's exact files.

## Stage 1 — Live synchronization acceptance

Status: implementation and automated checks complete; cross-device user acceptance still required.

- [x] Add school-scoped, generic server change events and authenticated SSE.
- [x] Add cross-tab notifications and background refresh/fallback polling.
- [x] Preserve unsaved attendance drafts and an unsaved signature canvas.
- [x] Publish events for unauthenticated onboarding request creation/activation.
- [x] Test tenant isolation, event cursors, stream framing, and successful-write/logout publishing.
- [ ] Open admin and teacher sessions in separate browser contexts and verify: admin assigns teacher → class appears; teacher changes a roster/attendance item → admin sees the update without manual reload.
- [ ] Repeat in the actual XAMPP/Apache deployment with more than one teacher session, confirming SSE isn't blocked by proxy buffering or request limits.
- [ ] Confirm offline changes remain local until reconnected, then synchronize without overwriting another user's newer attendance revision.

Gate: both roles observe authorized changes without logging out/in, with no cross-school or cross-class leakage.

## Stage 2 — Real school data and role assignments

- [ ] Confirm the target school's approved XLSX workbook, source year, active target academic year, class mapping, student identity matching, and import reconciliation report.
- [ ] Resolve the current preview account's missing active-year teacher assignment through the admin workflow; do not assign every class to a demo teacher just to populate the UI.
- [ ] Verify every active class has the intended teacher/subject assignments and that class/student counts reconcile to the source workbook.
- [ ] Test a student create/edit/transfer using approved test records, then verify historical enrollment and attendance links.

Gate: school representatives sign off on the imported counts and teacher-to-class access matrix.

## Stage 3 — Attendance and reporting reliability

- [ ] Run two teachers against the same class/lesson and confirm conflict handling preserves both users' pending work.
- [ ] Test all eight lesson periods and present/absent/late/excused/clear operations, sign-off, correction rules, archive, and monthly totals.
- [ ] Test disconnected/offline attendance entry, reconnection, retry, and conflict recovery on phones as well as desktop browsers.
- [ ] Reconcile monthly report totals against database-backed attendance fixtures.

Gate: no silent loss of an attendance edit, no duplicate records, and every report agrees with persisted state.

## Stage 4 — Security, recovery, and local installation

- [ ] Run the complete backend integration set and tenant/role-isolation tests against disposable databases.
- [ ] Review session invalidation, CSRF, rate limiting, uploads, SQL boundaries, SSE school filtering, logs, and secrets/config files.
- [ ] Follow `docs/DEPLOYMENT_AND_BACKUP.md` on a clean XAMPP machine from backup through install, update, rollback, and restore test.
- [ ] Verify the school database can be backed up and restored to another local machine without depending on the developer's Codespace.
- [ ] Confirm install/update instructions, first-admin setup, annual rollover, account recovery, and operator runbook are understandable by the school operator.

Gate: a tested restore, a documented recovery path, and no unresolved critical security or data-integrity issue.

## Stage 5 — Final acceptance and presentation

- [ ] Run frontend unit/type/lint/build checks, PHP lint, isolated backend integrations, Playwright desktop/mobile, and the complete clean-school acceptance workflow.
- [ ] Conduct a teacher/admin demo with separate accounts and approved demo data; avoid displaying real student data to an audience that is not authorized to see it.
- [ ] Prepare an issue/known-limitations register, versioned installation package, configuration example, database migration sequence, backup/restore instructions, and school handover checklist.
- [ ] Review all remaining working-tree changes, confirm no secrets or unintended school data are staged, and only then request explicit approval for a commit/push or release package.

Gate: the school sees a reproducible, recoverable, role-isolated local system and agrees to the remaining limitations before live deployment.

## Working rules

1. Inspect existing behavior and the current diff before changing a subsystem.
2. Prefer one bounded correction followed by focused tests and the full relevant regression suite.
3. Never run `database/schema.sql`, seed/demo scripts, destructive resets, or bulk cleanup against the school's populated database.
4. Don't hide failed tests or treat a successful build as proof of cross-device acceptance.
5. No cloud/SaaS or multi-tenant expansion before the independent local-school version is accepted.
6. Do not commit, push, or publish a release without the user's explicit instruction.

## Status snapshot after verification — 2026-10-23

| Stage | Current status | Closure blocker |
|---|---|---|
| 1. Live synchronization | **PARTIAL** — implementation and automated checks verified | Real administrator/teacher browser-session acceptance, XAMPP/Apache transport behavior, and offline reconnect/conflict acceptance |
| 2. School data and roles | **OPEN** | Approved XLSX reconciliation, active-year class/teacher assignment matrix, and school-side count/sign-off |
| 3. Attendance and reporting | **PARTIAL** — backend concurrency/report suites and fixture-based UI checks pass | Real multi-teacher acceptance, offline entry/recovery, all-period workflow, and persisted report reconciliation on the acceptance database |
| 4. Security, recovery, installation | **PARTIAL** — PHP lint, tenant-isolation, and security/reliability integration suites pass | Clean XAMPP install/update/rollback and verified restore to a separate local machine; operator runbook acceptance |
| 5. Final acceptance and presentation | **PARTIAL** — local frontend checks/build and targeted Playwright pass | Clean-school end-to-end workflow, real-backend browser rehearsal, final release/security review, install package, and school handover sign-off |

## Verification record — 2026-10-23

Executed against the current uncommitted working tree in Codespaces:

- Frontend unit tests: **30 test files, 103 tests passed**.
- Frontend TypeScript typecheck: **PASS**.
- Oxlint: **PASS, 0 warnings and 0 errors**.
- Frontend production build: **PASS**.
- PHP syntax lint across changed PHP files and relevant integration files: **PASS**.
- Isolated database integration suites: **PASS** for `integration`, `school-import`, `tenant-isolation`, `onboarding`, `profile-avatar`, `phase39`, `administration`, `attendance`, `phase6`, `phase7`, `phase38`, and `sync-events`. Each suite used a disposable `sams_test_*` database and the runner reported cleanup.
- Fixture-based Playwright checks for teacher attendance responsive behavior and concurrency conflict handling: **3 passed**.
- `git diff --check`: **PASS** at the end of the targeted fixes.

The checks found and fixed two test/schema alignment issues: the fresh-install `school_sync_events` table declaration now uses `IF NOT EXISTS` to keep the schema re-applicable, and the integration test's expected table inventory now includes `school_sync_events`. Both `integration` and `school-import` were rerun successfully after the corrections.

### Still unverified; do not mark the release gate closed

The current Codespaces database is named `sams`, and the real-backend Playwright demo suite changes attendance records. It was therefore not run against the existing populated database. Run it only against a disposable acceptance database or a clean staging instance with known credentials and reset/recovery procedure.

No real cross-role SSE acceptance was completed today: two authenticated browser contexts, same-school/class authorization, event reconnect after network interruption, offline PWA resynchronization, and the XAMPP/Apache configuration are still open. No clean-machine install or backup/restore to a second machine was performed. Do not infer school readiness from unit tests, mock-based Playwright, PHP lint, or a production build alone.

### Source-control release gate

- Active branch: `verification/final-demo-qa-2026-10-02` at `2d32bfb`.
- The current working tree has **76 modified tracked entries and 23 untracked entries**, with no staged changes.
- `git rev-list --left-right --count origin/main...HEAD` returned **28 / 212**: the current branch is behind `origin/main` by 28 commits and contains 212 commits not on `origin/main`.
- This divergence is a release blocker until the target release branch and reconciliation strategy are agreed. Do not merge, rebase, reset, or push the dirty working tree as a shortcut. Review/preserve all changes first and obtain explicit approval before any commit/push/merge.

**Planning estimate:** approximately **40% of formal release gates are closed**. This is a rough estimate across the five handoff stages, not a percentage of source code or feature implementation. Automated checks are currently green, but source-control reconciliation, school data/role sign-off, real cross-role/offline acceptance, clean local installation, and backup/restore still dominate the remaining work.

