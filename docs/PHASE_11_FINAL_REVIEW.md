# SAMS — Phase 11 Final Release Review

Status: CLOSED

Branch: feat/phase-11-final-review

## UNDERSTAND

Phase 11 is the final release-blocking review after Phases 1–10.
The review remains limited to release blockers. No unrelated product expansion or architecture rewrite is in scope.

Final reviewed release branch:
`feat/phase-11-final-review` at `40497e75d116d480a91cec5aa87c9d1f250fde22`.

Phase 8, Phase 9, and Phase 10 gates were already closed before the final review work. Phase 11 continued beyond the initial documented close because additional release-blocking correctness, reliability, deployment-boundary, and legacy-compatibility issues were found and fixed.

## PLAN

Review:

- architecture boundaries;
- API/security behavior;
- database integrity and migration safety;
- E2E coverage;
- deployment reproducibility;
- secrets/PII handling;
- concurrency and transactional safety;
- documented release limitations.

Any confirmed release blocker follows:

`reproduce → RED evidence → smallest safe fix → targeted verification → full regression → CI → diff review`

## RED

The first confirmed Phase 11 blocker was a migration documentation error.

The documented instruction previously listed migrations `001–004` as the in-place upgrade order for an existing installation.
The current `main` baseline already contains the schema changes represented by those migrations.

Applying `001_student_identity.sql` to the current `main` schema failed with:

`ERROR 1060 (42S21): Duplicate column name 'massar_code'`

This proved that the documented migration sequence could fail a real deployment workflow.

Subsequent release verification also exposed additional correctness/reliability gaps in legacy compatibility paths, request-size handling, Apache/runtime boundaries, concurrency coverage, and user lifecycle routing.

## IMPLEMENT

The final review corrected the supported release behavior without redesigning the domain.

### Migration contract

- Fresh installation uses the complete current `database/schema.sql`.
- The supported in-place upgrade for this release starts from `main` commit `4daaeb492923a7cdfb909b13c72ae39fb63d0e48`.
- Only `005_school_import_staging.sql` is applied from that baseline.
- Older migration files remain historical artifacts and are not presented as a current linear sequence.
- Schemas older than the supported baseline remain outside the verified automated upgrade path.
- CI migration verification is pinned to the exact release baseline.

### Final release hardening

The final release branch also contains verified fixes for:

- legacy administration/API mutations being routed through the canonical administration services;
- user lifecycle reset/unlock paths being routed through the administration service;
- student/attendance and transfer/deactivation concurrency boundaries;
- canonical root/mounted API path handling;
- early oversized-request rejection and correct request-size error behavior;
- fail-closed backend configuration/runtime checks;
- Apache boundary and sensitive-path protections;
- reproducible Composer/Node lockfiles and CI/runtime platform checks;
- release backup/restore verification and additional regression coverage.

These changes were kept within release correctness, security, reliability, deployment, and verification scope.

## VERIFY

The final release tree was checked for:

- no unrelated release-branch changes;
- migration documentation aligned with the supported upgrade contract;
- migration integration coverage;
- PHP syntax validity;
- JavaScript syntax validity;
- backend regression/integration coverage;
- Playwright E2E coverage;
- clean-school acceptance and persisted-state verification;
- Apache/runtime smoke behavior;
- backup/restore integrity;
- request-size and security hardening;
- `git diff --check`.

The local Codespace does not provide all production PHP extensions, so environment-complete acceptance remains a CI responsibility.

## Deployment evidence

An isolated Apache smoke confirmed:

- `/` redirects to `/public/` with HTTP 302;
- `/public/login.php` returns HTTP 200;
- `/api/v1/health` returns HTTP 200.

A second Apache + MariaDB container test enabled `pdo_mysql` and confirmed a DB-backed unauthenticated attendance request reaches SAMS authentication and returns the expected HTTP 401 rather than a server error.

An isolated MariaDB backup/restore test used synthetic data and confirmed after restore:

`students=1 | enrollments=2 | attendance=2 | signatures=1`

Attendance remained split across the two historical enrollment records (`1` row on each enrollment).

One earlier Apache setup attempt failed because the Codespace container could not resolve Debian package repositories. That was an environment/network limitation; the package-free Apache routing test and the later Apache + MariaDB test completed successfully.

## GREEN

Targeted release verification passed:

- exact release baseline → `005_school_import_staging.sql`: PASS;
- synthetic backup → restore with historical attendance split across two enrollments: PASS;
- Apache routing/static smoke: PASS;
- Apache + MariaDB DB-backed smoke: PASS;
- PHP syntax lint: PASS;
- JavaScript syntax check: PASS;
- `git diff --check`: PASS.

Final GitHub Actions Run #751 (`36491415403`) passed on exact head:

`40497e75d116d480a91cec5aa87c9d1f250fde22`

Jobs:

- `javascript`: PASS
- `php`: PASS
- `e2e`: PASS
- `apache`: PASS
- `clean-school-acceptance`: PASS

The earlier validation-only branch `validation/phase-11-final-gate` was tested against an older Phase 11 tree and produced an E2E failure; it is not the final release branch and is not the authoritative final-head gate.

## REVIEW

The final Phase 11 tree was reviewed against the actual post-migration-fix commits rather than the earlier provisional close.

The review confirms that the additional implementation work stayed within release-blocking correctness, security, reliability, deployment, and compatibility hardening.

No React rebuild, PWA implementation, or new product expansion was introduced during Phase 11.

## RELEASE GATE

CLOSED — the final release branch `feat/phase-11-final-review` at `40497e75d116d480a91cec5aa87c9d1f250fde22` passed the complete GitHub Actions release gate in Run #751.

Release integration into `main` is intentionally separate from this phase and must not be performed automatically.
