
# SAMS — Frontend Phase 20: Performance

Date: 2026-09-30

## Objective

Close official Phase 20 with evidence-driven frontend performance work.

ECC scope:
1. Establish production baseline.
2. Identify measurable frontend bottlenecks.
3. Apply the smallest architectural optimization that removes the bottleneck.
4. Add regression guards.
5. Re-run functional, build, quality, and security-adjacent gates.

## RED — Baseline

Before optimization, the Vite production build emitted one JavaScript entry:

- JS: 486.99 kB
- gzip: 135.08 kB
- CSS: 21.85 kB / 5.10 kB gzip

frontend/src/routes/router.tsx statically imported every application page, so the first route bundled teacher, admin, onboarding, and authentication page code together.

A production-preview browser probe also confirmed that the first route requested the single large JS entry.

## Bottleneck assessment

The dominant frontend issue was eager route code loading, not an identified render-loop, asset, or dependency hotspot.

Other reviewed surfaces did not justify speculative optimization:

- no image/font asset payloads were present under the frontend source tree;
- API calls observed on the teacher first route were limited to session + class context;
- the 72 kB raw shared hooks chunk is React Router runtime code, not the project's custom hook source;
- the translation dictionary is synchronous by design and was not changed because making i18n asynchronous would add complexity without a comparable first-route gain.

## GREEN — Optimization

Implemented route-level code splitting using React Router lazy route modules.

Changed:

frontend/src/routes/router.tsx

Application and onboarding pages now use dynamic imports through route lazy functions. The persistent shell, guards, and error boundaries remain synchronous.

This preserves the existing route architecture while ensuring page modules are fetched when their route is actually matched.

## Build result

After optimization:

- main entry: 299.91 kB / 91.67 kB gzip
- shared React Router runtime: 72.28 kB / 23.94 kB gzip
- page modules are emitted as separate hashed chunks;
- largest page chunk: TeacherAttendancePage at 17.16 kB / 5.08 kB gzip.

Representative route chunks include:

- TeacherDashboardPage: 2.52 kB / 0.86 kB gzip
- TeacherStudentsPage: 11.05 kB / 2.95 kB gzip
- AdminUsersPage: 7.29 kB / 2.11 kB gzip
- AdminArchivePage: 9.15 kB / 2.45 kB gzip

The route entry itself no longer contains every page implementation.

## Production browser measurement

Using isolated browser contexts against the production Vite preview:

- Teacher first route: 95,442 encoded JS bytes
- Admin users first route: 97,109 encoded JS bytes
- Login first route: 92,737 encoded JS bytes

These measurements use browser encodedBodySize; exact wire bytes can vary with deployment compression configuration.


## Performance regression contract

Added:

tests/e2e/frontend_phase20_performance.spec.js

The contract verifies:

- first teacher route stays within a 110 kB encoded-JS budget in production performance mode;
- first admin route stays within the same budget;
- login stays within the same budget;
- teacher dashboard is lazy-loaded;
- attendance chunk appears only after navigation to attendance;
- admin user chunk is lazy-loaded;
- teacher/admin page chunks are not eagerly loaded on unrelated first routes.

The byte budget is enabled with:

SAMS_PERFORMANCE_MODE=1

This is intentional because Vite development mode serves unbundled source modules and is not a valid compressed production-byte measurement.

## Verification

Phase 20 dedicated production suite: 3/3 PASS

Frontend regression scope covering Phases 12–19: 42/42 PASS

Quality gates:

- TypeScript typecheck: PASS
- oxlint: PASS, 0 warnings / 0 errors
- Vite production build: PASS
- npm audit --audit-level=high: PASS, 0 vulnerabilities
- git diff --check: PASS

A separate full repository E2E command was also observed to require the backend integration environment; those failures were connection/environment failures outside this frontend-only Phase 20 scope.

## ECC Gate

Phase 20 — Frontend Performance: PASS

Current official frontend state:

Phases 1–20 PASS

Next frontier:

Phase 21 — Frontend Testing

No backend/security/tenant foundation changes were made.
