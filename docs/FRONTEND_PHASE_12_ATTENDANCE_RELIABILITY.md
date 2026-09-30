# FRONTEND PHASE 12 — ATTENDANCE RELIABILITY

## Objective

Harden the Phase 11 teacher attendance workflow against asynchronous failures and competing navigation/auth actions.

## Reliability contract

The phase validates these states and transitions:

`idle → saving → saved`

`idle → saving → failed → retrying → saved`

`dirty/saving/retrying → blocked → saved → navigation`

A `Saved` message is emitted only after a successful mutation **and** an authoritative weekly refresh.

## Implemented

- Slow-network handling with persistent `saving` state.
- Single-flight save behavior: concurrent flush callers share one promise.
- Duplicate Save Now attempts cannot create duplicate HTTP writes while saving.
- Rapid changes to the same attendance cell collapse to the latest draft before the debounced bulk write.
- Failed bulk writes preserve the pending draft instead of silently discarding user work.
- Explicit Retry action with `retrying` state.
- Failed authoritative refresh keeps sent drafts pending because the server may already have committed the batch.
- React Router navigation blocking while attendance work is pending.
- Pending navigation is resumed only after the write is confirmed.
- Browser `beforeunload` guard while attendance work is pending.
- Logout is disabled while attendance work is pending through the existing application shell.
- Signed lessons remain blocked from editing.
- Server-authoritative refresh wins when a concurrent server-side change occurs during the write.
- Existing class/week navigation still flushes pending attendance before changing context.

## Architectural notes

No attendance business rules were moved into the browser.

The backend remains authoritative for:

- assignment/tenant authorization
- academic-year boundaries
- attendance validity
- duplicate-key/conflict rules
- signed-lesson protection
- persistence and transactionality

The frontend reliability layer only manages local async state, retryability, navigation safety, and server confirmation.

## E2E verification

Test file:

`tests/e2e/frontend_phase12_attendance_reliability.spec.js`

Result:

**12 / 12 PASS**

Coverage:

1. Desktop/mobile attendance workflow.
2. Bulk attendance mutation.
3. Failed save preserves draft + Retry.
4. Slow network + duplicate-save protection.
5. Rapid same-cell changes collapse to latest value.
6. Navigation during save waits for server confirmation.
7. Reload guard via `beforeunload`.
8. Logout blocked while work is pending.
9. Concurrent server change is reflected authoritatively.
10. Search/filter regression.
11. Signed lesson protection.
12. Existing week-navigation flush behavior.

## Static verification

- TypeScript: PASS
- oxlint: PASS — 0 warnings / 0 errors
- Vite production build: PASS
- `git diff --check`: PASS

## Backend verification limitation

The Codespace PHP CLI still lacks `pdo_mysql`, so the PHP attendance integration script cannot execute against MariaDB from PHP.

The full PHPUnit suite also has unrelated workbook-import failures because the same CLI lacks `ZipArchive`.

Those environment limitations are not counted as passing backend runtime evidence.

## Gate

# PASS

## Current project state

- Phase 1 — 10: CLOSED
- Phase 11 — Attendance Engineering: CLOSED
- Phase 12 — Attendance Reliability: CLOSED
- Phase 13 — Students / Classes: NEXT
