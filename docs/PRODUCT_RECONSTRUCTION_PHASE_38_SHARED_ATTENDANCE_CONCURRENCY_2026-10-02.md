# SAMS Phase 38 — Shared Attendance + Concurrency

Status: **Closed**

Remote verification is isolated in `.github/workflows/phase38-concurrency.yml` so Phase 38 concurrency checks do not alter the canonical full-project CI workflow.

## Objective

Protect the shared class attendance register against stale writes when multiple assigned teachers edit the same lesson.

A lesson is identified by:

`class_id + attendance_date + period`

The attendance rows remain the single shared source of truth. A separate revision ledger provides optimistic-concurrency metadata without duplicating attendance state.

## Server contract

GET `/api/v1/classes/{classId}/attendance?week_start=YYYY-MM-DD` returns:

`attendance_revisions: [{ attendance_date, period, revision }]`

A lesson with no revision history has revision `0`.

POST `/api/v1/classes/{classId}/attendance/bulk` requires every entry to include:

`expected_revision: non-negative integer`

All entries targeting the same lesson must use the same expected revision.

The server:

1. Revalidates authorization and attendance payloads.
2. Locks the class and lesson revision rows inside the existing transaction.
3. Compares `expected_revision` with the current server revision.
4. Rejects a stale desired state with HTTP `409 Conflict`.
5. Allows an idempotent retry when the desired end state is already committed.
6. Increments the lesson revision once when the lesson actually changes.
7. Keeps the revision row after attendance deletion so stale clients cannot recreate older state silently.

## Why no WebSocket

Phase 38 does not add WebSocket/SSE/polling. The current product requirement is stale-write protection, not live collaborative cursors. The solution stays compatible with the existing Apache + PHP session + MariaDB architecture and avoids introducing a new runtime component before evidence requires it.

## Frontend behavior

On HTTP 409:

- the latest server register is fetched;
- pending local edits are preserved;
- the UI exposes an explicit conflict state;
- the teacher can either **keep their changes** (rebase against the latest revision and retry) or **use the latest version** (discard the pending local edits explicitly).

There is no silent overwrite and no automatic destructive merge.

## Verification

Phase 38 verification is complete. Local verification and the dedicated remote GitHub Actions run both passed with real MariaDB 11.4 coverage, including concurrent teacher processes.

Local evidence:

- migration 009 integration: PASS;
- attendance backend integration: PASS;
- concurrency regression: 8/8 rounds PASS;
- tenant isolation integration: PASS;
- Phase 38 shared attendance concurrency integration: PASS;
- frontend typecheck: PASS;
- Oxlint: 0 warnings / 0 errors;
- frontend unit suite: 15 files / 58 tests PASS;
- production build: PASS;
- Phase 38 Playwright E2E: 1/1 PASS.

Remote evidence:

- dedicated Phase 38 GitHub Actions backend job: PASS;
- dedicated Phase 38 GitHub Actions frontend job: PASS.

The pre-existing grouped smoke suite remains outside the Phase 38 closeout scope; its two Phase 20 performance assertions are unrelated to the concurrency implementation.

## Verification target

Phase 38 required evidence for:

- assigned teacher authorization;
- stale-write rejection;
- concurrent assigned-teacher writes;
- idempotent retry;
- delete/recreate stale protection;
- per-lesson revision independence;
- atomic batch conflict behavior;
- frontend conflict/reconciliation state;
- migration creation;
- regression suites and production build.
