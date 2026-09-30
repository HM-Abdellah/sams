# SAMS — Frontend Phase 22 — Legacy Replacement

Date: 2026-09-30
Status: PASS

## Objective

Replace the PHP-rendered / Vanilla JS frontend as the active UI runtime while preserving
the PHP backend and its API authority.

The migration follows the repository legacy-removal gate:

1. dependency audit;
2. replacement exists;
3. behavior parity verified;
4. API contract verified;
5. relevant E2E verified;
6. production/reference path verified;
7. legacy references removed from the active runtime.

## RED — Legacy inventory

The old UI consisted of:

- public/index.php;
- public/login.php;
- public/assets/js/*.js;
- public/assets/css/*.css.

The legacy frontend was not imported by the React source. React pages already covered
teacher, admin, attendance, students, signatures, reports, onboarding, archive, and audit
workflows.

The legacy UI was therefore a runtime-entry problem rather than a missing feature problem.
## Replacement architecture

The active runtime is now:

Browser
  ↓
Apache (/sams/)
  ├── frontend/dist → React static build
  └── /api/v1/* → backend/public/index.php
                         ↓
                      PHP backend
                         ↓
                      MySQL/MariaDB

Node.js remains build-time/development-only.

React Router derives its basename from Vite BASE_URL so the application works when mounted
under /sams/ without hardcoded deployment-specific paths.

## GREEN — Runtime cutover

Implemented:

- root Apache rules now serve frontend/dist/index.html for non-file client routes;
- frontend assets resolve from frontend/dist/assets;
- /api/v1/* remains routed to the PHP front controller;
- frontend source/config/build internals are denied from Apache;
- old public/index.php and public/login.php UI files were removed;
- old public/assets JavaScript and CSS runtime files were removed;
- temporary public entry shims preserve old public UI URLs by redirecting them to React;
- PHP development router serves the built React frontend and preserves API routing.
## Compatibility boundary

The temporary shims are:

- public/login-shim.php
- public/index-shim.php

They are compatibility redirects only. They do not render UI and contain no business logic.

The old /api/*.php compatibility surface is a backend migration concern and was not removed
by this phase.

## Active E2E acceptance

Added:

tests/e2e/frontend_phase22_legacy_replacement.spec.js

Coverage:

- /sams/ serves the React application shell;
- /sams/login is owned by React Router;
- unknown client routes reach the React 404 page;
- legacy public/login.php redirects to /sams/login;
- legacy public/index.php reaches the React application;
- built React assets load under /sams/assets without request failures.

Result:

4/4 PASS.
## Real backend acceptance

Added:

tests/e2e/frontend_phase22_real_backend_smoke.spec.js

The intended CI clean-school acceptance uses deterministic synthetic E2E database fixtures
and the real PHP backend.

Coverage:

- teacher authenticates through the canonical backend;
- teacher reaches the reconstructed teacher workspace;
- teacher can reach attendance through the real API;
- admin authenticates through the canonical backend;
- admin reaches the reconstructed admin dashboard;
- logout removes the reconstructed application's protected access.

The clean-school CI job now uses this React/backend acceptance path.

## CI integration

CI now contains:

- frontend-build job producing frontend/dist with base /sams/;
- Apache job consuming the React build artifact;
- Apache production-path checks for React root, SPA fallback, legacy redirects, API routing,
  security headers, and private-path denial;
- active frontend E2E execution for Phases 12–19;
- Phase 20 production performance execution;
- Phase 22 legacy-replacement acceptance.

The old active legacy UI E2E specs were moved to tests/archived-legacy-ui and are explicitly
excluded from the active Playwright directory.
## Documentation

Updated:

- README.md;
- frontend/README.md;
- docs/FRONTEND_ARCHITECTURE.md;
- docs/DEPLOYMENT_AND_BACKUP.md;
- docs/FRONTEND_ROADMAP_RECONCILIATION_2026-09-29.md.

Historical Phase 1–11 documents may still mention the former public UI because they record
past architecture and acceptance states. Those references are not active runtime references.

## Backend impact

No backend implementation or database behavior was changed by the frontend legacy cutover.

The backend remains authoritative for authentication, authorization, tenant isolation,
attendance integrity, validation, transactions, and audit behavior.

## Verification status

Local verification performed:

- PHP syntax for compatibility shims: PASS;
- React production build with --base /sams/: PASS;
- Phase 22 legacy replacement E2E: 4/4 PASS;
- Phase 21 unit/integration suite: 45/45 PASS;
- frontend Phases 12–19 regression: 42/42 PASS;
- Phase 20 performance regression: 3/3 PASS;
- TypeScript typecheck: PASS;
- Oxlint: PASS, 0 warnings / 0 errors;
- npm audit --audit-level=high: 0 vulnerabilities;
- git diff --check: PASS.

Apache is not installed directly in the Codespace, but the cutover was also validated in a temporary Apache 2.4 container with real .htaccess processing. The repository CI Apache job remains the authoritative hosted-environment verification.
## ECC Gate

# PASS

Phase 22 — Legacy Replacement is closed.

The React frontend is now the active frontend architecture at the runtime boundary.
At the Phase 22 close, temporary public UI compatibility shims were retained pending production integration. Phase 23 subsequently removes that temporary compatibility surface and finalizes the `/sams/` production boundary.

Next frontier at the time of this record:

# Phase 23 — Production Integration

Design R&D + Figma remain closed until Phase 24 passes.
