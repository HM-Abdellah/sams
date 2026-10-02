# SAMS — Product Reconstruction Phase 35

Status: IN PROGRESS — implementation started on the isolated reconstruction branch.

## 1. Goal

Make high-impact Admin operational workflows transparent and trustworthy without inventing backend capabilities.

Current Phase 35 work is limited to supported surfaces:

- Imports
- Teacher onboarding
- Archive/history

Audit remains functionally usable and was inspected for contract/UX gaps; no unsupported API or data model was introduced.

Reports, Calendar, and Alerts remain unchanged where no dedicated Admin contract exists in the current backend.

## 2. ECC execution

INSPECT → UNDERSTAND → PLAN → RED → IMPLEMENT → GREEN → REFACTOR → REVIEW → VERIFY

For the first Phase 35 slices:

1. Inspect existing frontend/backend contracts.
2. Research external product/accessibility patterns.
3. Identify UI gaps against the real backend state model.
4. Add regression tests for intended behavior.
5. Implement the smallest compatible UI changes.
6. Run typecheck, lint, unit tests, production build, and diff checks.
7. Keep Phase 35 open until responsive/accessibility/E2E review and final CI verification are complete.

## 3. Research inputs

### W3C WCAG 2.2

Error feedback must identify the item in error and describe it. When a known correction exists, the interface should communicate a useful suggestion.

References:
- https://www.w3.org/WAI/WCAG22/Understanding/error-identification
- https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html

### WAI-ARIA APG

Workflow-interrupting confirmations are appropriate candidates for the alert dialog pattern; modal behavior must keep interaction inside the dialog and expose an accessible name/description.

Reference:
- https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/

### shadcn/ui

Data tables should be composed around their real sorting/filtering/pagination requirements rather than forced into one universal abstraction.

Reference:
- https://ui.shadcn.com/docs/components/aria/data-table

### openSIS

Bulk-import workflows use structured templates, required fields, validation, review, correction, and final submission rather than treating upload as an immediate mutation.

References:
- https://help.opensis.com/portal/en/kb/articles/data-operations
- https://help.opensis.com/portal/en/kb/articles/student-bulk-data-import-or-update

## 4. Implemented slices

### 4.1 Admin Imports

The UI now reflects the real import lifecycle:

Upload → Validation → Reconciliation → Final Import

Added:
- explicit workflow step indicator
- translated batch/class/row statuses
- translated validation/reconciliation issue codes
- warning/error summary
- class-level inspection action
- row-level preview for a selected class
- server-backed pagination for class rows
- match-state visibility for new/existing/conflict rows
- accessible confirmation dialog before reconcile/commit
- commit availability driven by the real reconciliation result (ready_to_import)
- no fake subject/class/attendance state
- no new backend endpoint

The existing authoritative backend remains unchanged:
- staging/validation
- target-class mapping
- school-scoped Massar ownership
- enrollment/identity conflict checks
- transactional commit
- audit recording

### 4.2 Admin Teacher Onboarding

The UI now exposes the lifecycle more clearly:
- translated pending/approved/rejected/expired states
- visible request expiration time
- rejection reason visibility for rejected requests
- accessible alert-dialog confirmation for rejection
- empty rejection reasons are omitted from the API call
- existing backend school scope and lifecycle rules remain authoritative

### 4.3 Admin Archive

Historical attendance statuses are now localized through the shared attendance vocabulary instead of raw backend values.

Status presentation uses semantic badge variants for Present, Absent, Late, Excused, and Unmarked.

No archive endpoint or data model was changed.

### 4.4 Shared confirmation semantics

Dialog now supports dialog and alertdialog roles.
ConfirmDialog uses alertdialog because it is a workflow-interrupting confirmation surface.

## 5. Regression coverage

Added:
- AdminImportsPage.test.tsx: class row inspection, translated detected issues, and alert-dialog confirmation before reconciliation.
- AdminOnboardingPage.test.tsx: alert-dialog confirmation before rejection and backend call contract for an empty rejection reason.

## 6. Verification snapshot

At code snapshot:
94f21c3bbaf534e277194e19c2c1399d0e9b0fae

verified locally:
- TypeScript: PASS
- Oxlint: PASS — 0 warnings / 0 errors
- Vitest: PASS — 15 files / 54 tests
- Production frontend build: PASS
- git diff --check: PASS
- working tree: clean

A final CI run for the eventual Phase 35 closeout is still required.

## 7. Constraints respected

No changes were made to:
- MariaDB/MySQL schema
- import service transaction model
- onboarding business rules
- archive API contract
- RBAC or tenant isolation
- teacher assignment authority
- attendance subject model
- realtime architecture

No fake data was introduced to fill unsupported Admin capabilities.

## 8. Remaining Phase 35 work

Still open:
- deeper responsive/mobile review of operational workspaces
- focused accessibility/E2E coverage where current suites do not exercise the new paths
- audit/activity UX review beyond the existing supported contract
- final review of recovery/error affordances
- final documentation reconciliation
- exact-head GitHub Actions verification

Phase 35 must not be marked CLOSED until all required gates pass on the final branch head.