# SAMS — Design R&D Phase 29
## Cross-Surface Consistency + Touch Interaction Refinement

Date: 2026-10-01
Status: COMPLETE — implementation, local verification, hosted CI, and merge closed

## Objective

Extend the verified SAMS design language beyond the reconstructed Admin and
Teacher reference surfaces without changing business behavior.

This phase closes concrete post-Phase-28 gaps found by repository audit:

- Teacher Students used a bespoke page heading instead of the shared PageHeader.
- Counselor used a separate heading/card composition.
- Compact Button controls defaulted to 36px minimum height.
- Attendance "Mark as" controls used 36px minimum height.

## Evidence

PR #28 is merged to main. The current frontend was audited directly in the
Codespace and remains React + TypeScript + Vite + Tailwind with semantic SAMS
tokens and a shared component layer.

The authenticated application already uses the shared PageHeader on most Admin
and Teacher surfaces. The remaining inconsistency was therefore localized
rather than a reason to redesign the shell.

## External research inputs

These sources informed constraints and pattern selection; SAMS product behavior
and the existing codebase remain the source of truth.

- W3C WCAG 2.2 — Target Size (Minimum) and Focus Not Obscured.
- Apple Human Interface Guidelines — 44pt hit regions and touch spacing.
- shadcn/ui — composable primitives and RTL-aware layout patterns.
- 21st.dev — dashboard hierarchy, tables, and meaningful UI states.
- Lightswind — admin/audit/data-density references.
- Refero — real product screens and flow references.

References:
- https://www.w3.org/TR/wcag/
- https://developer.apple.com/design/human-interface-guidelines/buttons
- https://ui.shadcn.com/docs/rtl
- https://docs.21st.dev/blog/react-dashboard-components
- https://lightswind.com/blocks/data-admin
- https://refero.design/apps

## Design decisions

### D29.1 — One page-header composition

Teacher Students and Counselor now use the existing PageHeader primitive so
title scale, description width, spacing, and action alignment follow one rule.

No new header component was introduced.

### D29.2 — Touch-safe compact actions

The shared Button size="sm" baseline is now 40px on narrow/mobile viewports and
returns to the existing 36px compact desktop density at md+.

This keeps compact actions above the WCAG 2.2 minimum and closer to touch-first
guidance without inflating dense desktop tables.

### D29.3 — Attendance mode controls

Attendance "Mark as" buttons use the same mobile-first 40px minimum height while
retaining semantic buttons and aria-pressed behavior.

Business statuses, save semantics, signed-lesson protection, and API contracts
are unchanged.

### D29.4 — Counselor visual language

Counselor class cards now use the existing sams-card surface treatment.
The read-only boundary remains unchanged.

## Scope boundary

This phase does not:

- alter backend behavior;
- change API contracts;
- change routing;
- replace native selects;
- change attendance statuses;
- introduce a new UI library;
- redesign public onboarding or system error pages.

## Verification

Local verification completed on the dedicated branch:

- TypeScript typecheck — PASS.
- Oxlint — PASS, 0 warnings / 0 errors.
- Vitest — PASS, 49/49 tests.
- Production Vite build — PASS; 180 modules transformed.
- Responsive + accessibility + onboarding + counselor browser checks —
  PASS, 16/16 tests.
- git diff --check — PASS.

The browser suite initially encountered ERR_CONNECTION_REFUSED because the Vite
dev server was not running; after starting the normal frontend dev server, the
same 16 tests passed without code-related failures.

## Exit criteria

- [x] Shared PageHeader adopted by Teacher Students and Counselor.
- [x] Mobile compact buttons use the new 40px baseline.
- [x] Attendance status-mode controls use the new 40px mobile baseline.
- [x] Counselor cards use the shared SAMS surface treatment.
- [x] Existing business and accessibility semantics remain intact.
- [x] Typecheck passes.
- [x] Lint passes.
- [x] Unit/integration tests pass.
- [x] Production build passes.
- [x] Responsive/accessibility E2E passes.
- [x] Changes are committed on the dedicated Phase 29 branch.

## Release gate

Hosted CI completed successfully on PR #29 before merge.
All seven hosted jobs passed: frontend-build, javascript, e2e, php,
clean-school-acceptance, apache, and production-integration.

PR #29 was merged to main as squash commit `34283284e6b56dac45247afe2ee4d3fa5c15b061`.

**PHASE 29 — COMPLETE**
