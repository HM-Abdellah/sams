# SAMS — Frontend Phase 16 — UI State System

Status: PASS — 2026-09-29

## Objective

Establish a consistent UI-state contract for server-backed React workflows so the frontend distinguishes:

- initial loading with no confirmed data;
- refreshing while preserving the last confirmed data;
- initial errors with no usable data;
- stale-data errors after a refresh failure;
- mutation progress without falsely treating local pending state as server confirmation.

The phase must preserve server authority and must not introduce a global state library.

## Implemented

### Shared async state contract

Added `frontend/src/types/ui-state.ts` with:

- `AsyncStatus`: idle/loading/success/error;
- `MutationStatus`: idle/saving/saved/failed/retrying/blocked;
- `BasicMutationStatus` for existing feature-specific mutation contracts using idle/saving/success/error;
- generic `AsyncResourceState<T>`;
- helpers for initial loading, refreshing, initial error, and stale-data error.

### Shared feedback primitive

Added `AsyncStateFeedback` and exported it from the UI index.

Behavior:

- no data + idle/loading → loading state;
- no data + error → error state with retry;
- existing data + loading → non-destructive refreshing message;
- existing data + error → stale-data error message plus retry;
- success → no extra feedback banner.

`StatusMessage` now accepts an action slot so the same primitive can expose retry without duplicating markup.

### Server-state preservation

Updated feature hooks so a failed refresh does not erase previously confirmed server data:

- `useAdminResource`;
- `useArchive`;
- `useMonthlyReport`;
- `useClassStudents`;
- `useTeacherClasses`.

Query-key protection was also added to archive, monthly reports, and attendance so changing the class/period/query cannot temporarily display data belonging to the previous server context.

### Page integration

Applied the shared state behavior to the main teacher/archive read workflows:

- teacher dashboard;
- teacher classes;
- teacher class details;
- teacher students;
- teacher reports;
- teacher attendance;
- admin archive.

Mutation-specific workflows such as attendance pending drafts and signatures keep their established local state semantics.

### i18n

Added FR/AR/EN translations for:

- refreshing feedback;
- stale-data refresh failure.

Arabic keeps document RTL behavior unchanged.

## ECC findings

### Finding 1 — duplicated async semantics

Different hooks independently declared the same loading/error state shape.

**Root cause:** no shared typed async-resource contract.

**Fix:** introduced `AsyncResourceState<T>` and shared status types while retaining feature-specific mutation semantics where needed.

### Finding 2 — destructive refresh errors

Some hooks cleared known-good data when a refresh failed.

**Impact:** the UI could lose usable server-confirmed context after a transient failure.

**Fix:** preserve `current.data` / current roster on refresh errors.

### Finding 3 — stale data across query changes

Preserving data blindly during every load could show the previous month/week/query while a new query was loading.

**Fix:** compare a stable query key. Same-query reload preserves data; query changes reset data before the new request.

### Finding 4 — page-level loading gates

Some pages returned a full loading/error screen whenever status changed, even when confirmed data still existed.

**Fix:** pages now render the existing content and add a non-destructive refresh/error feedback layer when stale data is available.

## Verification

Static gates:

- TypeScript typecheck: PASS
- Oxlint: PASS — 0 warnings / 0 errors
- Vite production build: PASS
- `git diff --check`: PASS

E2E:

- dedicated Phase 16: **2/2 PASS**
- combined regression Phases 12 → 16: **25/25 PASS**

The E2E cases specifically prove that:

1. confirmed roster data remains visible while a post-mutation refresh is delayed;
2. a failed refresh preserves the old roster and exposes a retry action.

Fixtures are synthetic and contain no real school/student PII.

## Scope boundary

Phase 16 establishes the shared UI-state contract and applies it to the highest-value server-backed teacher/archive workflows. It does not introduce Redux/Zustand or a global server-state cache, and it does not alter backend authorization or business logic.

## Gate

PASS.

📍 Current project state: Official frontend Phases 1–16 are PASS. Phase 17 — Responsive Engineering is next.
