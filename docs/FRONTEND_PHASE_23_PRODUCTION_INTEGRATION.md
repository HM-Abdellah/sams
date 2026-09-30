# SAMS — Frontend Phase 23 — Production Integration

Date: 2026-09-30
Status: IMPLEMENTED — hosted CI gate pending

## Objective

Verify the React frontend as the deployed production runtime, not only as a Vite/dev-router application.
The production contract is Apache 2.4 + PHP 8.3 + MariaDB/MySQL under `/sams/`, with React static assets and the canonical `/api/v1/*` PHP boundary.

## RED — Production-path finding

Apache verification exposed a real integration defect that the PHP development router did not reproduce:

- `/sams/app/teacher` returned `403` because the root `.htaccess` source-protection rule matched the legitimate React `/app/*` route prefix.
- The fix removed the broad `app` directory token from the deny rule and added file-only protection for real `/app/*` source files.
- After the fix, `/sams/app/teacher` returns `200`, while `/sams/app/bootstrap.php` remains `403`.

This is a production integration correction, not a backend behavior change.

## GREEN — Final runtime boundary

Implemented:

- React bundle remains the only active UI runtime under `/sams/`;
- `/api/v1/*` remains routed to `backend/public/index.php`;
- Apache serves the Vite bundle from `frontend/dist` and owns SPA fallback;
- real `/app/*` source files remain protected without blocking React client routes;
- former `public/index.php` and `public/login.php` UI entry points are retired and return `410 Gone`;
- PHP compatibility shims were removed;
- the PHP development router mirrors the retired-entry behavior for local testing;
- the existing `/api/*.php` compatibility surface remains untouched.

## Production integration E2E

Added:

`tests/e2e/frontend_phase23_production_integration.spec.js`

Coverage:

- React mount and stylesheet asset loading under `/sams/`;
- Apache SPA response for a protected client route;
- same-origin `/sams/api/v1/health` response;
- teacher authentication against PHP and session persistence across reload;
- admin authentication, dashboard access, logout, and protected-route guard;
- retired legacy UI entry points returning `410` without redirects.

The clean-school acceptance remains as a supplementary deterministic backend/frontend regression through the PHP development router. The dedicated production job is the authoritative Apache integration gate.

## CI integration

Added a dedicated `production-integration` GitHub Actions job that:

1. consumes the production React build artifact;
2. installs Apache 2.4, PHP 8.3, MySQL support, and Composer;
3. installs backend dependencies;
4. seeds the deterministic E2E school into MariaDB;
5. mounts the repository at `/sams/` behind Apache with `.htaccess` enabled;
6. runs the real-backend smoke plus Phase 23 production integration E2E;
7. verifies source-path denial and retired-entry `410` responses;
8. verifies the expected persisted clean-school database counts after browser execution.

## Verification performed in the Codespace

PASS:

- Apache 2.4 `apachectl -t`: previously verified `Syntax OK`;
- production static root `/sams/`: `200`;
- production login route `/sams/login`: `200`;
- production React asset: `200`;
- SPA route `/sams/app/teacher`: `200`;
- protected source file `/sams/app/bootstrap.php`: `403`;
- protected backend source: `403`;
- canonical API health: `200`;
- retired legacy login/index entry points: `410` / `410`;
- TypeScript/lint/frontend unit gates from the preceding phases remain preserved;
- Phase 23 E2E syntax and Prettier formatting: PASS.

The Codespace Docker environment could not execute a full PHP+MariaDB browser acceptance because outbound package networking and inter-container TCP connectivity are restricted in this environment. The dedicated GitHub Actions production-integration job is therefore the required final runtime verification for this phase.

## ECC Gate

Implementation is complete and locally verified at the static/runtime boundary. Final Phase 23 closure requires the hosted `production-integration` CI job to pass in its real Apache + PHP + MariaDB environment.

Next frontier after closure:

# Phase 24 — Final Frontend Engineering Audit

Design R&D + Figma remain closed until Phase 24 passes.
