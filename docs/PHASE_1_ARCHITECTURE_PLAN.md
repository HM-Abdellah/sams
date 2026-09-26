# Phase 1 — Architecture & Foundation Plan

Date: 2026-09-26

## Goal

Replace the current mixed PHP + Vanilla JS architecture with a clean, hosting-friendly full-stack structure while preserving validated school-domain behavior.

## Current baseline

The repository already contains meaningful backend/domain work:
- authentication and hardened sessions
- CSRF protection
- RBAC
- PDO repositories/services
- enrollment-aware attendance
- teacher/class assignments
- student import staging
- reports/archive/signatures
- CI and Playwright setup

The main architectural debt is the coupling between many public PHP entry points, legacy browser modules, and a presentation layer that no longer matches the target product.

## Tasks

### 1. Repository governance
Action: add root engineering rules in `AGENTS.md`.
Mirror: plan-first, TDD, review, verification workflow.
Validate: manual document review against the architecture and release criteria.

### 2. Final folder structure
Action: establish `frontend/`, `backend/`, `e2e/`, and documentation boundaries.
Implement: move runtime code only after replacement boundaries exist.
Validate: every runtime concern has one clear owner.

### 3. Backend boundaries
Action: introduce a backend front controller and clear Controllers/Services/Repositories/Middleware/Auth/Validation/DTO/Support boundaries.
Mirror: current service/repository separation where it already works.
Validate: Request -> Middleware -> Controller -> Service -> Repository -> Response.

### 4. API routing
Action: consolidate dispatch under `/api/v1/`.
Implement: preserve current API semantics during migration.
Validate: contract tests for protected and public API resources.

### 5. Authentication
Action: add teacher account activation lifecycle.
Implement: admin-created PENDING_ACTIVATION account, one-time activation credential, password setup, ACTIVE state.
Validate: one-time use, expiry, invalidation, no open registration.

### 6. Database migrations
Action: add forward-only migration discipline and `schema_migrations`.
Implement: incremental changes while preserving enrollment history.
Validate: fresh install, upgrade path, FK/unique/date integrity.

### 7. React frontend
Action: replace Vanilla JS presentation with React + TypeScript + Vite.
Implement: feature-based modules and typed API client, no Redux.
Validate: production build, TypeScript check, focused UI tests.

### 8. Attendance
Action: rebuild the paper-register workflow.
Implement: full weekly desktop register and Morning -> swipe -> Afternoon mobile view.
Validate: desktop/mobile E2E, bulk-save recovery, signoff/correction rules.

### 9. PWA
Action: add installable app shell.
Implement: manifest, icons, service worker, install UX.
Validate: build output and supported-browser installability.

### 10. Testing foundation
Action: formalize PHPUnit + MariaDB integration + Playwright and frontend tests where useful.
Implement: deterministic clean-school fixtures.
Validate: CI runs actual tests and exposes real evidence.

### 11. Deployment
Action: make the result deployable to Apache/PHP/MySQL shared hosting.
Implement: same-origin `/api` routing and static frontend deployment.
Validate: clean external deployment smoke test.

### 12. Legacy removal
Action: delete old Vanilla JS/PHP UI only after replacement parity.
Implement: remove legacy runtime paths and obsolete references.
Validate: repository search confirms no production imports of removed modules.

## Risks

| Risk | Level | Mitigation |
|---|---|---|
| Historical attendance corruption | High | Preserve enrollment-aware model; verify before/after |
| Authorization regression during routing centralization | High | API contract and feature tests |
| Attendance UX diverges from paper workflow | High | Treat register behavior as primary product spec |
| SMS becomes a hard dependency | Medium | Core activation works without SMS |
| Overengineering | Medium | One PHP app + one React app + one relational DB |
| Legacy code removed too early | High | Keep old runtime until E2E parity is green |
| Shared-host differences | Medium | Test Apache rewrite + PHP 8.3 + MariaDB |

## Verification gates

Phase 1:
- architecture documented
- engineering rules documented
- migration path documented
- definition of done documented

Later implementation phases:
- RED evidence
- GREEN evidence
- refactor while green
- integration verification
- E2E verification
- security verification
- final diff review

## Non-goals

Phase 1 does not implement SMS delivery, Google OIDC, offline attendance synchronization, microservices, GraphQL, WebSockets, Kubernetes/Swarm, or a large UI framework.
