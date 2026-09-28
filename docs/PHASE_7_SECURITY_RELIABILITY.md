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

- CI #598 failed the API HTTP smoke at the JSON-size contract: an oversized attendance request returned HTTP 422 instead of the documented 413.
- The root cause was controller-level `InvalidArgumentException` handling catching `RequestPayloadTooLargeException` before its dedicated status could be returned.
- The Phase 7 Git audit also emitted `not a git repository` and could false-pass because the test ignored the command failure.

### GREEN evidence

- `RequestPayloadTooLargeException` is now handled before generic `InvalidArgumentException` in the JSON-bearing canonical controller paths.
- Git tracked-path auditing is anchored to the repository path and fails closed when Git cannot execute.
- Fresh synthetic HTTP smoke passes health, authentication, RBAC, CSRF, headers, signatures, and 413 request-size checks.
- Backend PHPUnit: 33 tests / 130 assertions passed.
- Legacy checks: 13 passed / 0 failed.
- Phase 4, Phase 5, Phase 6, and Phase 7 MariaDB integration checks passed.
- Synthetic workbook/CSV size and row-limit rejection checks passed.
- Controlled DB failure returned generic HTTP 500 without SQL/internal-path leakage.
- JavaScript syntax checks passed.

### Current gate status

**OPEN — CI run #599 failed before creating any jobs/check-runs; local verification is green, but the CI gate is not yet satisfied.**

## Exit gate

Phase 7 closes only when no known critical authentication/integrity blocker remains, security regression coverage is green, CI is green, and the branch is clean.
