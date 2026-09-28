# SAMS — Phase 11 Final Release Review

Status: CLOSED

Branch: feat/phase-11-final-review

## UNDERSTAND

Phase 11 is the final release-blocking review after Phases 1–10.
The review is limited to release blockers. No product feature expansion and no architecture rewrite are in scope.

Current reviewed release branch:
`feat/phase-10-deployment-documentation` at `fcb91fa7cf2c9ce39e5d87e876da1b2870dd5401`.

Phase 8, Phase 9, and Phase 10 gates are closed on the repository history reviewed for this phase.

## PLAN

Review architecture boundaries, API/security behavior, database integrity and migration safety, E2E coverage, deployment reproducibility, secrets/PII handling, and documented release limitations.
Any confirmed release blocker follows:

`reproduce → RED evidence → smallest safe fix → targeted verification → full regression → CI → diff review`

## RED

A release-blocking migration documentation error was reproduced in an isolated MariaDB environment.

The documented instruction previously listed migrations `001–004` as the in-place upgrade order for an existing installation.
The current `main` baseline already contains the schema changes represented by those migrations.

Applying `001_student_identity.sql` to the current `main` schema failed with:

`ERROR 1060 (42S21): Duplicate column name 'massar_code'`

This proves that the documented migration sequence could fail a real deployment workflow.

## IMPLEMENT

The fix narrows and makes the supported migration contract explicit:

- Fresh installation uses the complete current `database/schema.sql`.
- The supported in-place upgrade for this release starts from `main` commit `4daaeb492923a7cdfb909b13c72ae39fb63d0e48`.
- Only `005_school_import_staging.sql` is applied from that baseline.
- Older migration files remain as historical artifacts and are not presented as a current linear sequence.
- Schemas older than the supported baseline are explicitly outside the verified automated upgrade path.

CI migration verification is pinned to that exact release baseline instead of a moving branch name.

## VERIFY

Static review must confirm:

- the working tree has no unrelated changes;
- the migration documentation no longer instructs operators to apply the historical files as a current sequence;
- the migration integration test still exercises the three whole-school staging tables;
- PHP sources remain syntactically valid;
- JavaScript/E2E sources remain syntactically valid;
- the full GitHub CI gate is green on the resulting commit.

The local Codespace does not provide all production PHP extensions, so environment-complete acceptance remains a CI responsibility.


## Deployment evidence

An isolated Apache smoke confirmed:

- `/` redirects to `/public/` with HTTP 302.
- `/public/login.php` returns HTTP 200.
- `/api/v1/health` returns HTTP 200.

A second Apache+MariaDB container test enabled `pdo_mysql` and confirmed a DB-backed unauthenticated attendance request reaches SAMS authentication and returns the expected HTTP 401 rather than a server error.

An isolated MariaDB backup/restore test used synthetic data and confirmed after restore:

`students=1 | enrollments=2 | attendance=2 | signatures=1`

Attendance remained split across the two historical enrollment records (`1` row on each enrollment).

One earlier Apache setup attempt failed because the Codespace container could not resolve Debian package repositories. That was an environment/network limitation; the package-free Apache routing test and the later `pdo_mysql` Apache+MariaDB test both completed successfully.

## GREEN

Targeted release verification passed:

- exact release baseline → `005_school_import_staging.sql`: PASS;
- synthetic backup → restore with historical attendance split across two enrollments: PASS;
- Apache routing/static smoke: PASS;
- Apache + MariaDB DB-backed smoke: PASS;
- PHP syntax lint: PASS;
- JavaScript syntax check: PASS;
- `git diff --check`: PASS.

GitHub Actions Run #723 (`36467396229`) passed on exact head `b2733b01a9144b36afc9c5b12b87f2d7e6ddc7d1`.
Jobs `php`, `javascript`, `e2e`, and `clean-school-acceptance` all completed successfully.

## REVIEW

Phase 11 changed only release/deployment verification material:

- `.github/workflows/php-ci.yml`
- `database/MIGRATIONS.md`
- `docs/DEPLOYMENT_AND_BACKUP.md`
- `docs/PHASE_10_DEPLOYMENT_DOCUMENTATION.md`
- `tests/migration_005_integration.php`
- `docs/PHASE_11_FINAL_REVIEW.md`

No backend domain implementation, database schema, attendance logic, authentication logic, or frontend behavior was changed.

## RELEASE GATE

CLOSED — no release-blocking issue remains in the reviewed release-tree after the migration-path correction and full CI validation.
