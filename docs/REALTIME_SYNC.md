# SAMS real-time cross-surface synchronization

## Contract

The school database remains the single source of truth. The browser never treats an event as a data payload: a real-time message only means **something changed**. Each open screen re-reads its own authorized endpoint, so teachers continue to see only assigned classes and the server's normal school/role checks remain authoritative.

## Transport

- `GET /api/v1/events` is an authenticated, same-origin Server-Sent Events (SSE) stream.
- The stream emits only `event: data-changed` with the generic JSON shape `{"type":"data-changed"}`. It does not send student, attendance, class, username, or other school records.
- Each stream is bound to the authenticated session's `school_id`. Reads from `school_sync_events` always filter by that school ID.
- A successful authenticated POST/PUT/PATCH/DELETE publishes a generic signal at request shutdown. Teacher onboarding request creation and activation also publish from the service after their database transaction commits, because those public actions do not have an authenticated school session.
- Logout publishes the school signal before destroying the session.
- EventSource reconnects automatically and resumes using `Last-Event-ID`. A connection is intentionally bounded and reconnects, with keep-alive comments so proxies do not treat it as idle.

## Client behavior

`frontend/src/features/sync/changeSignal.ts` shares one SSE connection per JavaScript context and fans events out to subscribed views. `BroadcastChannel` (with a storage-event fallback) informs other tabs in the same browser. `useLiveRefresh` coalesces duplicate refresh requests with a 250 ms minimum refresh gap and also handles focus, visibility, and network recovery. A low-frequency 10-second poll remains as a fallback if SSE is unavailable.

The live refresh is wired into the shared administrative resource, teacher class directory, student roster, attendance register, monthly reports, archive snapshots, teacher signature editor, and the attendance-signature availability check. The public onboarding-status page polls every five seconds while a request is pending or approved but not activated; that page has no authenticated school session and therefore cannot open the private school stream.

Attendance drafts and a locally edited signature canvas are protected from background refresh while unsaved. The server's attendance revision/concurrency checks remain the authority when two users edit the same lesson.

## Database and installation

- Fresh installs get `school_sync_events` from `database/schema.sql`.
- Existing installs must apply `database/migrations/012_school_realtime_sync_events.sql` once, after verifying the supported earlier migrations and taking a verified backup.
- Migration 012 is additive: it creates only the event metadata table and does not rewrite student, class, enrollment, or attendance rows.
- The Codespaces test environment has migration 012 applied. After application, read-only verification confirmed the original data counts remained 925 students, 29 classes, 925 enrollments, zero attendance rows, and zero leftover test events.
- The Codespaces PHP preview uses eight PHP CLI server workers so a bounded SSE connection does not hold the only development-server worker. This development setting is not a substitute for the school deployment check on XAMPP/Apache.

## Verification

Run from the repository root:

```bash
cd frontend
npm run test:unit
npm run typecheck
npm run lint
npm run build
```

The isolated backend integration suites verify stream framing, event cursor behavior, school separation, no business-data leakage, successful-write publishing, logout publishing, and anonymous onboarding request/activation publishing:

```bash
docker exec sams-codespace-php-live php /workspace/tests/run_isolated_database_integration.php sync-events
docker exec sams-codespace-php-live php /workspace/tests/run_isolated_database_integration.php onboarding
```

Before school handoff, run the manual two-session acceptance scenario in `docs/FINAL_HANDOFF_PLAN_2026-10-23.md` using an administrator and a teacher with a real current-year teaching assignment. Verify the teacher's assignment and roster visibility, not merely a successful stream connection.
