# SAMS — Phase 8 Playwright E2E

Status: CLOSED

Validation cycle: final exact-head CI gate passed.

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

## Final gate

CLOSED after exact-head CI validation.

Evidence:
- CI run #665 on head `087d0d1` completed successfully.
- PHP regression job: SUCCESS.
- JavaScript syntax job: SUCCESS.
- Playwright E2E job: SUCCESS.
- All nine E2E groups passed: smoke 2/2, teacher-core-1 4/4, teacher-core-2 2/2, imports 4/4, history-and-signatures 4/4, admin-and-logout 2/2, phase8-admin 3/3, phase8-auth 3/3, phase8-mobile 5/5.
- Total browser gate: 29/29 passed.
- Critical-suite static guards passed: no skipped/focused tests and no `waitForTimeout`.
- No application/backend domain behavior was changed to bypass a failing assertion.

Release-blocking fixes verified during the validation cycle:
- CI now resets the synthetic E2E database before every journey group, preventing cross-group attendance state leakage.
- The teacher-assignment browser journey now waits for the server-backed assignment refresh before selecting the next class, removing the observed UI refresh race.

No merge is part of this phase gate. Validation PR #22 remains open and validation-only.


## CI execution note

The full browser gate is executed as separate Playwright subprocesses for the smoke suite, authenticated journey groups, administration lifecycle, authentication lifecycle, and mobile suite. This preserves the complete test set while preventing a single long-lived browser process from accumulating memory.

The validation base branch is CI-only and is based on the closed Phase 7 head; it is not a product release branch and must not be merged.


## Latest validation cycle

- CI run #644 validated the previous head `37824d1` and reported failures only in `history-and-signatures` and `phase8-admin`.
- The following head changes were then applied on this Phase 8 branch: removal of invalid single-class assumptions and deterministic per-group E2E database reset.
- The final validated head is `087d0d1`; validation PR #22 tracks this branch against `feat/phase-8-ci-base-v2`.
- CI run #665 is the final exact-head browser gate recorded for this phase.
