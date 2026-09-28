# SAMS — Phase 8 Playwright E2E

Status: OPEN

Validation cycle: final CI gate pending.

Validation base: feat/phase-8-ci-base-v2.

Deterministic isolation: CI resets the synthetic E2E database before each journey group.

Phase numbering in the current release execution plan:
- Phase 8 — Playwright E2E
- Phase 9 — Clean-School Acceptance
- Phase 10 — Deployment & Documentation
- Phase 11 — Final Review

## Goal

Prove the complete SAMS product workflows through a real browser, real authentication, real HTTP APIs, deterministic synthetic fixtures, and desktop/mobile execution.

The phase does not redesign the application. It strengthens the existing E2E gate and fills release-blocking coverage gaps.

## Required journey

login -> dashboard -> teacher -> attendance -> students -> users -> assignments -> academic year -> imports -> reports -> archive -> signatures -> logout

## Acceptance criteria

### Authentication

- Unauthenticated protected-page redirect.
- Successful admin and teacher login.
- Wrong credentials rejected.
- Inactive account rejected.
- Account lock and administrator unlock are exercised through the UI.
- Password reset is exercised through the UI and the reset credential is used for a real login.
- Logout invalidates the protected browser session.
- No critical authentication test may be skipped.

### Administration

- Dashboard.
- Classes.
- Users.
- Teachers.
- Teacher/class assignments and access changes.
- Academic-year creation, activation, and restoration.

### Teacher

- Assigned-class isolation.
- Weekly attendance.
- Real bulk attendance save.
- Correction after save/signing.
- Failure/recovery coverage already present in the backend regression suite and existing E2E contract.
- Lesson and weekly signatures.

### Students

- Create.
- Update.
- Deactivate.
- Transfer.
- Historical attendance remains visible after transfer.

### Imports

- Real upload and staging.
- Invalid CSV rows.
- Correction.
- Revalidation.
- Commit.
- Real XLSX HTTP upload.
- Whole-school import flow coverage.
- Existing UI-only mocked reconciliation test remains supplemental; it is not used as the only evidence for the import gate.

### Reports / archive / signatures

- Weekly printable register.
- Monthly analytics report.
- Daily archive.
- Monthly archive/history.
- Student history.
- Signature reload/persistence.
- Weekly signature and administration receipt flow.

### Responsive

- Desktop Chromium project.
- Dedicated mobile project using Pixel 5 profile.
- Critical authenticated teacher flow runs on mobile, not only unauthenticated smoke.

## Determinism and synchronization rules

- No `test.skip`, `test.fixme`, or focused `test.only`/ `describe.only` in the E2E tree.
- No `waitForTimeout` as synchronization.
- Synthetic fixture names and identifiers are deterministic.
- Tests synchronize on API responses or observable UI state.
- Assertions target externally visible behavior, not private implementation details.

## RED evidence

The Phase 8 baseline review identified four release-gating problems:

1. The authenticated suite used multiple `test.skip` guards when credentials were absent.
2. The mobile Playwright project excluded `authenticated.spec.js`, so authenticated mobile coverage was not part of the mobile gate.
3. The attendance batching test intercepted and fulfilled the API request instead of proving persistence through the real backend.
4. The attendance test used a fixed `waitForTimeout(800)` instead of synchronization on the real network response.

The repository also had missing explicit browser journeys for:
- wrong credentials,
- inactive account,
- password reset verification,
- lock/unlock recovery,
- academic-year activation visibility,
- assignment-driven teacher access changes,
- complete student create/update/deactivate lifecycle.

Local execution on the developer Codespace also exposed environment limitations: the local PHP runtime lacked the required MySQL/GD extensions and the Playwright browser executable was not installed. These are infrastructure limitations of that local runtime and are not treated as application test results; CI remains the authoritative full-browser environment.

## Implementation

- Removed authenticated E2E skip paths.
- Replaced attendance mocking/sleep synchronization with a real backend request/response assertion.
- Added deterministic Phase 8 authentication lifecycle coverage.
- Added deterministic admin/student/assignment/academic-year coverage.
- Added a dedicated authenticated mobile suite.
- Split desktop and mobile Playwright project matching.
- Added CI enforcement against skipped/focused E2E tests and fixed sleeps.
- Kept real XLSX/Markdown/CSV import paths already present in the suite.
- Kept existing mocked whole-school reconciliation coverage explicitly supplemental.

## Current gate

OPEN pending:
- final Playwright CI execution on the Phase 8 branch,
- desktop green,
- mobile green,
- zero skipped critical workflow,
- review of CI evidence and final diff.

No merge is part of this phase gate.


## CI execution note

The full browser gate is executed as separate Playwright subprocesses for the smoke suite, authenticated journey groups, administration lifecycle, authentication lifecycle, and mobile suite. This preserves the complete test set while preventing a single long-lived browser process from accumulating memory.

The validation base branch is CI-only and is based on the closed Phase 7 head; it is not a product release branch and must not be merged.

