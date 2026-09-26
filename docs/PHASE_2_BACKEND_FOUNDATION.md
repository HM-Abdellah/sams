# Phase 2 — Backend Foundation

Date: 2026-09-26

## Goal

Establish the real PHP backend boundary without changing validated school-domain behavior.

## Implemented foundation

- Application classes moved from app/ into backend/src/ with the existing SAMS namespaces preserved.
- backend/src/bootstrap.php is the canonical bootstrap for both the new backend and the legacy compatibility path.
- Composer PSR-4 autoloading is the primary class-loading mechanism, with a minimal fallback autoloader for ordinary PHP hosting.
- backend/public/index.php is the new API front controller.
- /api/v1/ is the centralized REST/JSON surface.
- GET /api/v1/health is the first independently testable route.
- Request, response, and routing primitives are isolated from domain code.
- Root app/bootstrap.php is now only a compatibility bridge for the still-active legacy /api/*.php endpoints.
- The existing legacy API and Vanilla JS frontend are deliberately retained until their new equivalents are verified.
- CI now targets PHP 8.3 and runs backend PHPUnit tests in addition to the existing verification layers.

## Compatibility guarantees for this phase

No domain schema or attendance behavior is changed.

The legacy API continues to call the same service/repository classes, now autoloaded from backend/src/. Database configuration supports both the new backend/config/database.php location and the existing root config/database.php location so local installations do not break during the move.

## Verification target

Phase 2 is complete only when:

1. GET /api/v1/health returns HTTP 200 and the standard {success,data} envelope.
2. Wrong HTTP methods return HTTP 405 with an Allow header.
3. Unknown API routes return HTTP 404.
4. Backend PHPUnit unit tests are green.
5. Legacy service tests and MariaDB integration tests remain green.
6. Existing Playwright flows remain green.
7. PHP lint passes for the migrated source tree.
8. main remains untouched until the branch is explicitly reviewed and merged.

## Not included

Authentication flow redesign, teacher activation, domain service refactoring, API endpoint migration from api/*.php, database migration tooling, React, PWA, and legacy frontend deletion are later phases.
