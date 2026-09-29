# SAMS — Frontend Phase 7 — State Architecture

Status: PASS — 2026-09-29

## Objective

Establish explicit state ownership rules for the React reconstruction without introducing a global state dump or an unnecessary state-management library.

## State ownership

### Session state

Owned by the small auth/session context.

Contains authenticated identity, role, school identity, session status, CSRF lifecycle, and session invalidation actions.

### Server state

Owned by feature workflows and retrieved through typed feature API adapters.

Examples: attendance, students, classes, teachers, dashboard, archive, reports, signatures, and administration datasets.

The browser is not an authoritative database mirror.

### UI state

Owned locally by the component or feature workflow that needs it.

Examples: open dialogs, temporary form values, local action progress, selected view mode, and ephemeral interaction state.

### URL state

Owned by the route using React Router search parameters when the value should survive refresh, deep linking, or back/forward navigation.

Examples: class, week, month, report period, archive view, search, and filter context.

High-frequency ephemeral interaction state does not belong in the URL.

### Cross-cutting presentation state

I18n/locale state is held by its dedicated provider because it affects document language and direction across the application.

## Global-state decision

No Redux, Zustand, global event bus, or server-state cache has been introduced.

The current evidence does not justify a centralized state library. Feature state can remain close to the workflows that own it.

## Async and mutation semantics

The shared state types define:
- idle
- loading
- success
- error
for asynchronous reads, and:
- idle
- saving
- saved
- failed
- retrying
- blocked
for mutations.

These status models support the SAMS requirement that the UI distinguishes local pending state from server-confirmed state.

## Security boundary

State does not become an authorization mechanism.

React role state may drive navigation and presentation only. Backend PHP remains authoritative for authorization, tenant ownership, attendance integrity, signatures, account lifecycle, and audit truth.

No password, secret, or unnecessary sensitive auth material is persisted in browser storage.

## Verification

Static repository inspection confirms:
- only session and i18n contexts are cross-cutting React contexts;
- feature data is not held in a global store;
- browser localStorage and sessionStorage are unused;
- no Redux, Zustand, or server-state library is installed;
- URLSearchParams usage is confined to API adapters today;
- local UI state remains colocated with the owning page/component.

TypeScript typecheck and lint validate the shared state model.

## Phase gate

PASS.

Phase 7 establishes the state ownership model needed before feature implementation and avoids premature global state infrastructure.

The original implementation sequence temporarily built the later UI and i18n foundations ahead of this official Phase 7. Those valid changes remain; the roadmap accounting is now explicit.

📍 Current project state: Official frontend Phases 1–7 are accounted for; Phase 8 i18n and Phase 9 component foundation are already implemented ahead-of-sequence and remain preserved.
