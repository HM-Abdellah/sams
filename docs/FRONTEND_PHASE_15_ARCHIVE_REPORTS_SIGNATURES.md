# SAMS — Frontend Phase 15 — Archive / Reports / Signatures

Status: PASS — 2026-09-29

## Objective

Implement the archive, monthly reports, printable report action, and class-signature workflows on the canonical /api/v1 backend boundary.

## Implemented

### Archive

Added a feature-owned typed archive API and admin page.

Supported archive views:
- recorded days for a month;
- enrollment-aware monthly student totals;
- historical day roster and attendance;
- student history within the selected historical class.

The UI uses the existing admin class administration response so inactive and historical classes remain selectable without inventing a second class source.

Archive navigation state is kept in the URL.

The archive is read-only. No attendance mutation is exposed from this workflow.

### Reports

The existing monthly report flow remains server-backed through GET /api/v1/classes/{id}/report?month=YYYY-MM.

The report page now exposes a browser print action without moving report arithmetic or attendance semantics into the frontend.

### Signatures

Replaced the teacher signature placeholder with a real pointer-enabled canvas workflow:
- load saved signature;
- draw a new signature;
- save as PNG data URL;
- reload persisted signature;
- clear persisted signature.

The frontend sends mutations through the canonical signature API. CSRF remains handled by the shared API client and the server remains authoritative for PNG validation, class access, persistence, and auditing.

The frontend signature type was aligned with the actual backend response shape: id, signature_data, mime_type, updated_at.

## ECC findings

### RED — archive loader refetch loop

The first implementation passed an inline loader into useAdminResource. Because the hook memoizes the loader callback, every render could create a new callback and refetch continuously, detaching form controls.

Minimal fix:
- memoize the admin class loader with useCallback;
- memoize the archive parameter object so query changes, not ordinary renders, control archive fetches.

### RED — contract/type mismatch

The initial frontend signature model assumed fields that the backend repository does not return.

Fixed by aligning the TypeScript model with the actual canonical response payload.

### Review

Archive student history uses an explicit student ID input because the canonical student-history endpoint requires student_id; the frontend does not invent an additional enumeration endpoint.

Historical archive data is displayed using enrollment-aware fields returned by the server.

## Files added / changed

Frontend:
- frontend/src/features/archive/types.ts
- frontend/src/features/archive/api.ts
- frontend/src/features/archive/useArchive.ts
- frontend/src/pages/app/AdminArchivePage.tsx
- frontend/src/pages/app/TeacherSignaturesPage.tsx
- frontend/src/features/signatures/api.ts
- frontend/src/pages/app/TeacherReportsPage.tsx
- frontend/src/routes/router.tsx
- frontend/src/features/i18n/types.ts
- frontend/src/features/i18n/dictionary.ts

Tests:
- tests/e2e/frontend_phase15_archive_reports_signatures.spec.js

Documentation:
- docs/FRONTEND_PHASE_15_ARCHIVE_REPORTS_SIGNATURES.md
- docs/FRONTEND_ROADMAP_RECONCILIATION_2026-09-29.md

No real school or PII fixtures were introduced.

## Verification

Phase 15 E2E: 3 passed.

Cross-phase regression: 23 passed across Phases 12–15.

Static gates:
- TypeScript typecheck: PASS
- Oxlint: PASS — 0 warnings / 0 errors
- Vite production build: PASS
- git diff --check: PASS

The current Codespace environment does not provide the normal MariaDB/PHP extension stack, so DB-backed integration execution is not claimed from this frontend session.

## Gate

# PASS

Current project state:
Phase 1–15 = PASS

Next frontier:
Phase 16 — UI State System

Design R&D + Figma remain deferred until after Phase 24.