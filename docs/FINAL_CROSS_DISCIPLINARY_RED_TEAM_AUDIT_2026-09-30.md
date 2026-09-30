# SAMS — Final Cross-Disciplinary Engineering + Security Red-Team Audit

Date: 2026-09-30
Audit scope: repository state represented by PR #28 against `main`
Status: **PASS — EXTERNALLY VERIFIED**

## Executive result

The final adversarial review identified and closed a concrete tenant-isolation gap in Massar-based student import reconciliation.

The previous flow performed a global `massar_code` lookup, then used the result while reconciling a workbook inside the authenticated school's target class. Because student ownership is derived from the student's class → academic year → school relationship, a cross-school match could have associated the wrong tenant's student with the current school's import workflow.

The fix now:

- scopes Massar lookups by authenticated `school_id`;
- detects a Massar code already owned by another school without returning that student's details;
- treats that collision as a blocking reconciliation issue;
- verifies the behavior with tenant-isolation integration coverage.

The repository-level findings were remediated in PR #28, and the release code passed hosted verification in GitHub Actions Run #818. The only subsequent change is documentation-only audit metadata; the runtime/application code remains unchanged from the verified release-code head.

## Audit domains

### Architecture

Reviewed:

- React + TypeScript + Vite frontend;
- PHP 8.3 backend;
- Apache production boundary;
- REST/JSON API;
- controller → service → repository layering;
- MariaDB/MySQL schema and tenant ownership model;
- CI workflow and deployment documentation;
- legacy API compatibility boundary.

Observed architecture remains intentionally small and monolithic. No unnecessary framework or infrastructure expansion was introduced.

### Authentication and session security

Reviewed the documented and implemented boundaries for:

- server-managed PHP sessions;
- session ID rotation on authentication;
- idle and absolute session limits;
- `session_version` invalidation;
- account lifecycle invalidation;
- CSRF token rotation and constant-time verification;
- password hashing and password verification;
- generic credential error handling and lockout behavior;
- SAMS Code issuance, hashing, revocation, and reissue;
- authenticated admin recovery.

The browser is not treated as the authorization authority.

### RBAC and tenant isolation

Reviewed:

- admin, teacher, and counselor route boundaries;
- server-side role enforcement;
- school-scoped repositories/services;
- class access derived from server-side assignments;
- onboarding school ownership;
- academic-year and class ownership;
- audit-log school scope;
- import batch and reconciliation scope;
- student transfer scope.

#### Finding F-01 — Massar cross-tenant association risk

**Severity:** High

**Evidence:**

`StudentRepository::studentsByMassarCodes()` previously returned a global student match by Massar code.

`SchoolWorkbookImportReconciliationService` consumed that global result while operating with an authenticated school scope.

**Impact:**

A Massar code belonging to another school could be treated as an existing student during the reconciliation workflow instead of being rejected as a cross-tenant collision.

**Remediation:**

`studentsByMassarCodes()` now accepts an optional school scope and joins through class → academic year to require the requested school.

`massarCodesOwnedByOtherSchools()` reports only the matching Massar identifiers outside the authenticated school.

The reconciliation service marks `student_massar_owned_by_another_school` as blocking.

The commit path also uses the school-scoped lookup.

A regression was added to `tests/tenant_isolation_integration.php`.

**Disposition:** Closed in PR #28.

### SQL / injection review

Reviewed representative repository and controller surfaces for:

- prepared statements;
- dynamic placeholder construction;
- integer-bounded pagination;
- request-controlled SQL fragments;
- raw query construction.

No new unbounded user-controlled SQL construction was identified in the reviewed release surfaces.

The application keeps PDO emulated prepares disabled in the tested configuration.

### Browser attack surface

Reviewed frontend source for:

- `dangerouslySetInnerHTML`;
- `innerHTML`;
- `outerHTML`;
- `eval`;
- `new Function`;
- browser storage;
- credential persistence;
- unsafe redirect destinations;
- console logging;
- TypeScript suppression escapes;
- placeholder/dead UI markers;
- hard-coded localhost/API destinations.

The previous frontend security review already recorded clean results for these categories. The final repository review found no regression.

### API and transport

Reviewed:

- canonical `/api/v1` boundary;
- same-origin frontend API construction;
- `/sams/` production mount;
- production PHP front controller;
- response security headers;
- CSRF enforcement for protected mutations;
- public onboarding CSRF exception;
- legacy API compatibility surface.

A production-only path mismatch discovered during Phase 23 was already fixed and covered by the hosted integration gate.

### Apache / static frontend security

Added:

`frontend/public/.htaccess`

with static-response protections for the React production mount:

- X-Content-Type-Options: `nosniff`;
- Referrer-Policy: `same-origin`;
- X-Frame-Options: `DENY`;
- restrictive Permissions-Policy;
- same-origin Content-Security-Policy with no object embedding and no framing;
- same-origin form actions.

The blanket no-cache directive was intentionally not retained so Vite hashed assets can continue to use normal caching semantics.

The Apache CI gate now checks the presence of these headers on `/sams/login`.

### Dependency and supply-chain review

Existing backend CI includes:

- Composer validation;
- platform requirement verification;
- locked dependency audit.

PR #28 additionally adds:

`npm audit --audit-level=high`

to the frontend build path.

The previously recorded local frontend audit returned **0 vulnerabilities** at the high severity threshold.

### File upload / import security

Reviewed workbook and CSV import boundaries for:

- extension validation;
- upload validation;
- file-size limits;
- worksheet limits;
- row limits;
- parsing errors;
- staged validation;
- reconciliation before production mutation;
- database transactions;
- rollback behavior;
- filename normalization;
- audit logging.

The import pipeline remains staged and transactional. Cross-school Massar ownership is now explicitly blocked.

### Session and secret handling in CI

The repository's CI scans tracked secret/config paths and rejects committed runtime credentials/config files.

The current README intentionally contains no demo passwords or real credentials.

### Accessibility and frontend quality

Historical Phase 18/19/20/21/24 evidence remains part of the audit baseline:

- axe accessibility coverage;
- responsive desktop/mobile verification;
- route-level code splitting;
- Vitest regression;
- Playwright frontend regression;
- final browser sweep.

Recorded Phase 24 baseline:

- 45/45 unit tests;
- 42/42 frontend regression;
- 47/47 final browser sweep;
- 5/5 Phase 24 audit;
- 3/3 production performance regression.

### Production verification baseline

PR #27 was validated by GitHub Actions Run #804 with:

- PHP;
- E2E;
- frontend build;
- JavaScript checks;
- clean-school acceptance;
- production integration;
- Apache checks.

All seven jobs passed in that run before PR #27 was merged into `main` as:

`1bb1b837672d87af20cab09711f133aee29fe4d7`

## Documentation / README review

The README was fully rewritten during this audit follow-up.

The new version:

- matches the current React/PHP/Apache architecture;
- documents teacher, administration, onboarding, and counselor workflows;
- documents the security model;
- provides setup and verification commands;
- links the authoritative engineering documents;
- includes a repository map;
- separates build-time Node.js requirements from production runtime requirements;
- explicitly states that PWA/offline attendance synchronization is outside the current release scope;
- removes stale claims about an active PWA shell;
- avoids credentials and demo secrets.

## External verification result

PR #28 is the current release follow-up branch.

PR #28 remains open and mergeable against `main`.

The latest release-code head covered by hosted verification is `5fee6aaf6e7e94d36025b77826f990241f2d1993`.

GitHub Actions Run #818 completed successfully across all seven release jobs on the branch containing that release code plus the documentation-only audit update:

- PHP;
- E2E;
- frontend build + high-severity npm audit;
- JavaScript checks;
- clean-school acceptance;
- production integration;
- Apache checks.

The published `frontend/e2e-groups` commit status is also successful.

The tenant-isolation regression, dependency audit, production Apache integration, and static security-header assertions are therefore externally verified for the current release code. Changes after that verification are documentation-only.

## ECC decision

**PASS — FINAL CROSS-DISCIPLINARY ENGINEERING + SECURITY GATE VERIFIED**

Run #818 satisfies the external verification conditions for the PR #28 release code with all seven jobs successful and the frontend E2E commit status green. The current diff since that run is documentation-only.

No new release-blocking finding was reported by that hosted run.

## Audit frontier

Current engineering frontier:

**Design R&D + Figma**

No visual redesign work is included in this audit.
