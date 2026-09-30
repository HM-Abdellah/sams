# SAMS — Final Cross-Disciplinary Engineering + Security Red-Team Audit

Date: 2026-09-30
Audit scope: repository state represented by PR #28 against `main`
Status: **CONDITIONALLY READY — EXTERNAL VERIFICATION REQUIRED**

## Executive result

The final adversarial review identified and closed a concrete tenant-isolation gap in Massar-based student import reconciliation.

The previous flow performed a global `massar_code` lookup, then used the result while reconciling a workbook inside the authenticated school's target class. Because student ownership is derived from the student's class → academic year → school relationship, a cross-school match could have associated the wrong tenant's student with the current school's import workflow.

The fix now:

- scopes Massar lookups by authenticated `school_id`;
- detects a Massar code already owned by another school without returning that student's details;
- treats that collision as a blocking reconciliation issue;
- verifies the behavior with tenant-isolation integration coverage.

The release cannot be marked fully project-green from this audit alone because GitHub has not exposed a completed Actions run/status for PR #28's current head. The prior PR #27 release gate is independently evidenced by CI Run #804 and remains part of the historical verification baseline.

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

## What remains externally verifiable

PR #28 is the current release follow-up branch.

At the time of this audit, GitHub exposed:

- PR #28 open;
- head: `773114809fa43ce369a7bc641c0e05dcc90d83a2`;
- base: `main` at `1bb1b837672d87af20cab09711f133aee29fe4d7`;
- mergeable: true.

However, the GitHub connector returned no workflow runs and no commit statuses for the current PR #28 head.

Therefore this document deliberately does **not** claim that the new Massar regression, npm audit gate, or Apache static-header assertions have passed in hosted CI.

## ECC decision

**CONDITIONALLY READY — EXTERNAL VERIFICATION REQUIRED**

Conditions:

1. GitHub Actions must produce a completed run for PR #28.
2. The tenant-isolation regression must pass.
3. The frontend dependency audit must pass at the configured high-severity threshold.
4. The Apache production integration must pass, including static security-header assertions.
5. No new release-blocking finding may appear in that run.

Design R&D + Figma remains closed until these conditions are externally verified.

## Audit frontier

Current engineering frontier:

**GitHub-hosted verification of PR #28 → final project-wide release gate → Design R&D + Figma**

No visual redesign work is included in this audit.
