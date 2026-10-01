# SAMS — Product Reconstruction & Engineering Roadmap

Date: 2026-10-01
Branch: reconstruction/product-system-2026-10-01
Base: main at 64a081294f7ec08612c85007d671aeb13f49c4c6

## Purpose

This roadmap governs the post-release product reconstruction work. The existing React/PHP/API/database foundation is preserved; we improve it progressively instead of rewriting from zero.

## Baseline
- Frontend Phases 1–24 complete.
- Design R&D Phases 25–29 complete.
- Main is clean and synchronized at 64a081294f7ec08612c85007d671aeb13f49c4c6.
- Runtime: React + TypeScript + Vite + Tailwind, PHP 8.3, REST/JSON API, MariaDB/MySQL, Apache.
- Existing security/red-team and tenant-isolation work is preserved.
- Teacher Attendance and responsive foundations already exist and must not be broken.
- PWA/offline attendance remains a later post-online-release track.

## Non-negotiable rules
1. Inspect repo, backend, database, tests, docs, and real workflow evidence before major changes.
2. Use Deep Research for major UX/product/architecture decisions.
3. Treat responsive behavior as engineering, not cosmetic patching.
4. Mobile is deliberately designed, not a shrunken desktop.
5. Backend authorization remains the security authority.
6. Data integrity is higher priority than visual convenience.
7. Find root cause, make the smallest safe fix, then regression-test it.
8. Preserve working functionality and contracts unless evidence requires a change.
9. Each phase has explicit exit criteria.
10. Do not merge the reconstruction into main until the final gate passes.

---

# PHASE 30 — BASELINE + PRODUCT WORKFLOW RECONCILIATION
Goal: build the exact current-state map before redesign work.

Work:
- Audit Admin, Teacher, and Counselor routes and workflows.
- Reconcile frontend routes, API routes, backend permissions, and database relationships.
- Map current capabilities against real school feedback.
- Identify UX, responsive, data, security, performance, and architecture gaps.
- Define in-scope reconstruction work and post-release backlog.

Exit criteria: major decisions are traceable to repository evidence, documented feedback, or validated research.

# PHASE 31 — DESIGN SYSTEM + RESPONSIVE FOUNDATION
Goal: establish shared visual and responsive rules used by every later surface.

Work:
- Audit tokens, typography, spacing, radius, elevation, semantic colors, component states.
- Define layout/container rules and responsive contracts.
- Define rules for navigation, tables/lists, charts, forms, dialogs, touch targets, focus, and state feedback.
- Validate at 320px, 390px, 768px, 1024px, 1280px, and 1440px+.

Exit criteria: shared primitives behave predictably and accessible semantics remain intact.

# PHASE 32 — APPLICATION SHELL + INFORMATION ARCHITECTURE
Goal: create coherent role-aware navigation and context.

Work:
- Admin, Teacher, and Counselor navigation.
- Desktop sidebar and mobile navigation/drawer.
- Header/context model.
- Active states, page hierarchy, content widths, and global context where appropriate.

Exit criteria: users always understand location and active workflow on mouse, touch, and keyboard.

# PHASE 33 — ADMIN DASHBOARD RECONSTRUCTION
Goal: turn the Admin dashboard into an operational control center.

Structure:
Context → KPIs → Attendance Today → Trend → Needs Attention → Teachers Online → Classes → Quick Actions.

Work:
- Academic year/date context.
- Students, teachers, classes, attendance metrics.
- Attendance distribution and trends.
- Incomplete classes, teacher presence, high-absence students, class health, alerts.
- Meaningful drill-down paths.

Research references: openSIS, PowerSchool, SchoolHub, modern enterprise/admin patterns, accessibility/data-visualization guidance.

Exit criteria: dashboard clearly answers what is happening now and where admin intervention is needed; metrics match backend data; mobile priority order is intentional.

# PHASE 34 — ADMIN MANAGEMENT WORKSPACES
Goal: rebuild administration surfaces as connected operational workspaces.

Surfaces: Teachers, Students, Classes, Users, Assignments, Academic Years.

Work:
- Search/filter/sort.
- Teacher presence/activity.
- Teacher ↔ Subject ↔ Class assignments.
- Class workspace summaries.
- Student attendance context.
- Account lifecycle and assignment access implications.
- Responsive tables, forms, dialogs, and state feedback.

Exit criteria: admin can understand and modify institutional relationships; mutations persist correctly; authorization, CSRF, validation, and audit remain enforced.

# PHASE 35 — ADMIN OPERATIONS + DATA WORKSPACES
Goal: make high-impact operational workflows transparent and trustworthy.

Surfaces: Imports, Onboarding, Audit/Activity, Archive, Reports, Calendar, Alerts where supported.

Work:
- XLSX: upload → preview → validation → warnings/errors → confirmation → result.
- Onboarding lifecycle clarity.
- Archive/history and reporting consistency.
- Calendar tied to real academic context.
- Alert prioritization.
- Data-quality checks: duplicates, invalid relationships, transaction behavior, audit coverage, historical consistency.

Exit criteria: operational state is understandable, failures are recoverable, mutations are traceable.

# PHASE 36 — TEACHER HOME + MY CLASSES + CLASS WORKSPACE
Goal: center the teacher experience on daily work.

Journey: Teacher Home → My Classes → Class Workspace → Attendance / Students / Reports / Signatures.

Work:
- Today's classes, attendance progress, alerts, recent activity.
- Class workspace for students, assigned teachers, subjects, attendance, reports, activity.
- Server-side class assignment enforcement.

Exit criteria: teacher reaches the correct class/task quickly; shared class workspace is clear; no social-collaboration concept is introduced.

# PHASE 37 — TEACHER ATTENDANCE RESPONSIVE RECONSTRUCTION
Goal: make attendance the fastest, clearest, safest workflow.

Context: Class, Date/Week, Subject, Period.
Statuses: Present, Absent, Late, Excused, Clear/unmarked.
Periods: Morning P1–P4; Afternoon P5–P8.

Desktop: morning + afternoon can be shown together.
Mobile: readable student rows/cards, intentional period navigation/scroll, no cramming all eight periods into a narrow viewport.

Work:
- Student search and filters.
- Mark-as controls.
- Period summaries.
- Saving, dirty, error/retry, and signing states.
- Sticky/contextual controls.
- Touch and keyboard behavior.

Exit criteria: rapid entry works comfortably on phone and desktop; persistence survives reload/navigation; no tiny or ambiguous controls.

# PHASE 38 — SHARED ATTENDANCE + CONCURRENCY
Goal: safely support multiple assigned teachers on the same register.

Principles:
- One shared source of truth.
- No teacher-specific attendance copies.
- Only assigned teachers can access a class.
- No silent overwrites.

Investigate based on evidence: optimistic concurrency, versioning, conflict detection, idempotency, transactions, and polling/SSE/WebSocket only when justified by deployment constraints.

UX: subtle active-editor awareness, last-updated information, meaningful conflict messages.

Exit criteria: concurrent edits cannot silently corrupt newer state; backend authorization is enforced; conflicts are tested.

# PHASE 39 — DATA + ANALYTICS + REPORTING CONSISTENCY
Goal: make dashboard, reports, archive, and attendance use consistent business metrics.

Work:
- Define attendance metric semantics.
- Reuse calculation rules where appropriate.
- Compare dashboard/report totals with stored attendance.
- Verify archive/history continuity.
- Review analytical query/index performance.
- Detect data-quality anomalies.

Exit criteria: the same metric means the same thing everywhere and outputs match persisted data.

# PHASE 40 — SECURITY + DEVSECOPS + INFRASTRUCTURE HARDENING
Goal: re-audit the redesigned product after functional changes.

Security domains: authentication, authorization, RBAC, school isolation, sessions, CSRF, API security, object-level authorization, validation, SQL safety, uploads, secrets, headers, auditability.

Infrastructure: Windows, Apache, PHP 8.3, MariaDB/MySQL, school LAN, production mount, API boundary.

DevSecOps: dependency audit, CI checks, security regressions, production configuration review.

Exit criteria: no known release-blocking security regression; direct unauthorized API access is rejected; CI security controls remain green.

# PHASE 41 — ACCESSIBILITY + PERFORMANCE + VISUAL QA
Goal: dedicated cross-surface quality pass after redesign.

Accessibility: keyboard, focus, semantics, labels, dialogs, tables, contrast, naming, reduced motion.
Performance: bundle behavior, lazy routes, renders, payloads, query cost, mobile loading/perceived performance.
Visual QA: 320px, 390px, 768px, 1024px, 1280px, 1440px+.

Inspect: overflow, clipping, wrapping, cramped controls, sticky areas, tables, modals, charts, spacing consistency.

Exit criteria: no obvious visual/interaction defects and no unaddressed material performance regression.

# PHASE 42 — FULL INTEGRATION + REAL BROWSER QA
Goal: verify complete user journeys across frontend, API, backend, and database.

Trace: UI → API → Auth → Router → Controller → Service → Repository/PDO → SQL → Database → Response → UI state.

Test: login/logout, admin workflow, teacher workflow, counselor read-only, assignment access, attendance save/correction/signature, reports/archive, import/onboarding, unauthorized access, session expiry, network/API failure, reload/navigation, mobile/desktop, keyboard/touch.

Exit criteria: critical workflows pass in a real browser with no silent persistence or authorization failures.

# PHASE 43 — PRODUCTION DEPLOYMENT REHEARSAL
Goal: prove the redesigned release works outside development.

Validate: clean install, configuration, Apache rewrite, PHP sessions, production mount, SPA routing, API routing, static assets, database, permissions, logs, backup/restore, production build.

Exit criteria: fresh environment can run the release from documented procedures and production-like smoke tests pass.

# PHASE 44 — FINAL RELEASE GATE
Goal: freeze the reconstructed product.

Run: git diff --check, typecheck, lint, unit tests, production build, PHPUnit, backend/integration suites, Playwright E2E, security regressions, clean-school acceptance, manual demo flow, responsive QA.

Exit criteria: green verification gate, clean working tree, only intended changes, no unresolved P0/P1 defect, main untouched until explicit merge.

# PHASE 45 — POST-ONLINE PWA ARCHITECTURE
Starts only after online release is stable.

Goal: design installability and offline behavior before implementation.
Research: manifest, service worker, caching, storage, IndexedDB, authentication constraints, school LAN behavior.

Exit criteria: offline architecture is documented and security/sync assumptions are explicit.

# PHASE 46 — OFFLINE ATTENDANCE + SYNC
Goal: allow attendance recording during temporary connectivity loss.

Work: IndexedDB, pending mutations, retries, idempotency, stale data handling, reconnection, conflict detection/resolution, user feedback, data protection.

Exit criteria: offline attendance works, reconnect sync is safe, duplicate writes and conflicts are predictable.

# PHASE 47 — PWA INSTALLATION + FIELD QA
Goal: finish installable SAMS experience.

Work: manifest, service worker, install UX, icons/assets, update lifecycle, online/offline status, sync status, device testing.

Exit criteria: installability and offline sync pass where supported without regressions to online mode.

## Phase execution rule
Every phase follows: Explore → Research → Decide → Construct → Verify → Document → Git-check → Close.

Every phase records: goal, evidence, files changed, technical decisions, tests, visual QA, security impact, known limitations, exit status.

## Priority order
Correctness → Data integrity → Security → Core workflow → Responsive usability → Accessibility → Performance → Visual polish.

## Current position
Phase 34 — Admin Management Workspaces.
Phase 30 baseline reconciliation, Phase 31 shared design-system/responsive foundation, Phase 32 application shell + information architecture, Phase 33 Admin Dashboard Reconstruction, and Phase 34 Admin Management Workspaces are closed on the reconstruction branch.
Phase 34 verification is complete on branch head `935b066634ccd41aac33eddadc6739b35fdb0fc9`; GitHub Actions run #943 passed all seven required gates.
The working branch remains isolated from main: reconstruction/product-system-2026-10-01.

## Current status
Phase 34 is closed. Phase 35 — Admin Operations + Data Workspaces — is next; implementation has not started.
