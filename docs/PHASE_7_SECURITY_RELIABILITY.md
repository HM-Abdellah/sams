# Phase 7 — Security and Reliability

Date: 2026-09-27

## Goal

Perform a release-focused security and reliability pass over the existing SAMS architecture without redesigning the application.

## Scope

- Authentication/session invalidation and session-version enforcement.
- RBAC isolation and inactive-user restrictions.
- CSRF enforcement on state-changing routes.
- Prepared PDO behavior and repository SQL boundaries.
- JSON request-body size limits and existing import upload/row limits.
- Transaction rollback and duplicate/conflict handling.
- Safe server-side error responses.
- Security response headers.
- Tracked secrets/PII path audit.
- Synthetic regression evidence only.
## Existing protections to preserve

- Login rotates the session ID and CSRF token.
- Authenticated sessions are checked against the database session_version and active state.
- Password reset, unlock, and user profile mutations increment session_version.
- State-changing canonical routes require CSRF.
- Database connections disable PDO emulated prepares.
- Workbook and CSV imports already enforce file/row limits.
- Domain mutations use transactions where integrity requires them.
- Canonical API catches unexpected exceptions and returns generic 500 responses.

## Security hardening targets

1. Add a bounded JSON request body guard before JSON decoding.
2. Centralize baseline API security headers, including CSP, Permissions-Policy, and conditional HSTS.
3. Add automated regression coverage for session invalidation, CSRF, headers, request-size rejection, prepared PDO mode, inactive-user login, and tracked sensitive config paths.
4. Keep existing legacy compatibility behavior unless a release-blocking security defect is proven.
## Acceptance criteria

### Authentication / session

- Login success establishes a rotated session identity.
- Changed session_version invalidates an existing session.
- Inactive users cannot authenticate and an already-authenticated inactive user is rejected.
- Idle/absolute session expiration clears the authenticated state.

### Authorization / CSRF

- Teacher cannot access another teacher's class data.
- Counselor cannot use admin-only mutation/read paths outside its documented scope.
- State-changing canonical routes reject missing/invalid CSRF.

### Input / SQL / reliability

- JSON bodies above the application limit return 413 before decoding.
- Existing import limits remain enforced.
- PDO emulated prepares remain disabled.
- Transaction rollback preserves the previous durable state after a forced failure.
- Duplicate/conflicting mutations remain rejected with safe statuses.
### Error / headers / secrets

- Unexpected server failures expose only a generic public error.
- API responses include X-Content-Type-Options, Referrer-Policy, X-Frame-Options, CSP, and Permissions-Policy.
- Strict-Transport-Security is emitted only for HTTPS requests.
- No tracked local secret/config files are present in Git.
- No real-school/PII fixture is introduced.

## ECC gates

1. UNDERSTAND — inspect authentication, session lifecycle, request parsing, upload limits, SQL, error handling, headers, and tracked files.
2. PLAN — freeze this scope and acceptance criteria before implementation.
3. RED — add security regression tests and prove at least the new hardening expectations fail before implementation.
4. IMPLEMENT — apply the smallest changes needed; preserve existing architecture.
5. GREEN — run focused Phase 7 tests plus full regression, PHPUnit, HTTP smoke, JavaScript syntax, and Playwright E2E.
6. REVIEW — inspect diff for security regressions, secret leakage, unsafe SQL, and behavior changes.
7. VERIFY — final CI, clean tree, temporary-artifact removal, and Phase 7 sign-off.
## Non-goals

- No architecture rewrite.
- No authentication provider migration.
- No new framework.
- No frontend redesign.
- No new analytics or post-release feature expansion.
- No real school data.

## Verification record

### RED evidence

- CI #598 exposed a request-size contract defect: an oversized JSON attendance request returned HTTP 422 instead of the documented 413.
- Root cause: `RequestPayloadTooLargeException` was caught after generic `InvalidArgumentException` in affected canonical controllers.
- The initial Phase 7 repository audit could emit `not a git repository` inside the PHP service container and could false-pass because command failure was ignored.
- A subsequent CI/E2E run exposed committed remote-tool wrapper metadata at the top of three canonical controllers and the Phase 7 integration test. This broke `declare(strict_types=1)` parsing when the v1 import path loaded those controllers.

### GREEN evidence

- The request-size catch order was corrected in `AttendanceController`, `SignatureController`, and `AdminApiController`/signature handling so oversized JSON returns HTTP 413.
- The contaminated controller/test files were restored to valid PHP source while preserving the Phase 7 behavior changes.
- The runtime Phase 7 integration no longer depends on `.git` metadata inside the CI service container.
- The dedicated CI secret/config audit now checks the tracked tree for the exact CI commit through the GitHub repository tree API, rejecting tracked `.env*` files (except `.env.example`) and local config files.
- Local verification on the final code head reported: full PHP lint PASS, JavaScript syntax PASS, YAML parse PASS, wrapper/metadata scan clean, and `git diff --check` PASS.
- CI push run **#36366650663** on commit `00a9323` passed **PHP + JavaScript + Playwright E2E**.
- CI pull-request run **#36366654735** on commit `00a9323` passed **PHP + JavaScript + Playwright E2E**.
- The passing PHP CI job verified the legacy suite, backend PHPUnit, migration 005, MariaDB integration, whole-school import, teacher attendance, administration, Phase 6 archive/reports/signatures, Phase 7 security/reliability integration, tracked-secret audit, and API HTTP smoke.
- Playwright E2E verified the real Markdown fallback upload and real XLSX upload through the authenticated v1 import path in addition to the existing authenticated flows.
- Existing targeted evidence also covers 413 body limits, import file/row limits, generic DB-down 500 behavior, CSRF, RBAC/resource isolation, inactive-user/session invalidation, prepared PDO mode, transactions, duplicate/conflict handling, and security headers.
- No real-school PII was added to the repository; repository fixtures remain synthetic.

### Current gate status

**CLOSED on the verified code head `00a9323`: no known critical authentication blocker, no known critical authorization blocker, no known critical data-integrity blocker, security regression green, existing regression green, and both push/PR CI workflows green.**

The branch remains unmerged; no automatic PR merge was performed. This gate is based on automated regression/security coverage and code review, not on a formal external penetration test or an absolute security certification.

### Final CI record

- Push: `36366650663` — SUCCESS.
- Pull request: `36366654735` — SUCCESS.
- Verified code head: `00a932350ae3597e63c36b1986c9bbdff7c8ff32`.


## Exit gate

Phase 7 closes only when no known critical authentication/integrity blocker remains, security regression coverage is green, CI is green, and the branch is clean.
