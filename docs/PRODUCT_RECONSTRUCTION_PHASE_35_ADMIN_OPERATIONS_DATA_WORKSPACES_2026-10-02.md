# SAMS — Product Reconstruction Phase 35

Status: CLOSED — implementation verified by GitHub Actions run #974 on exact implementation head 300e28a67e1d015eb88766ccb1089b9286d6fbac.

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

## 6. Final verification

Exact implementation head:
300e28a67e1d015eb88766ccb1089b9286d6fbac

Local verification at the final implementation tree:

- TypeScript: PASS
- Oxlint: PASS — 0 warnings / 0 errors
- Vitest: PASS — 15 files / 54 tests
- Production frontend build: PASS — 182 modules
- git diff --check: PASS
- targeted Phase 14 admin E2E: PASS — 7/7
- targeted Phase 15 archive/report/signature E2E: PASS — 9/9
- Phase 17 responsive/mobile E2E: PASS — 11/11
- Phase 18 accessibility E2E/Axe: PASS — 11/11

GitHub Actions:

- Run #974
- exact head: 300e28a67e1d015eb88766ccb1089b9286d6fbac
- javascript: PASS
- frontend-build: PASS
- clean-school-acceptance: PASS
- php: PASS
- e2e: PASS
- apache: PASS
- production-integration: PASS

The working implementation tree was clean before the documentation-only closeout update.
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

## 8. Phase 35 exit status

Phase 35 exit gates are closed.

The phase does not introduce Admin Reports, Calendar, or Alerts functionality because the current backend does not expose a dedicated contract for those capabilities. They remain explicit future scope rather than simulated UI.

The final CI gate passed before this documentation-only closeout update.
