[Reading 67 lines from start (total: 67 lines, 0 remaining)]

# SAMS Phase 38 — Shared Attendance + Concurrency

Status: **In progress**

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

## Verification target

Phase 38 requires evidence for:

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

[executed on device: codespaces-052ecf (81686ebc-c2a3-4f3f-931c-1c91ab9990de)]