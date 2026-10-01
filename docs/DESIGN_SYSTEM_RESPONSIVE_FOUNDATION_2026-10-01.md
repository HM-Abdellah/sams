# SAMS — Phase 31 Design System + Responsive Foundation

Date: 2026-10-01
Branch: reconstruction/product-system-2026-10-01

## Goal

Establish shared visual, layout, interaction, and responsive contracts before reconstructing Admin and Teacher surfaces.

## Research basis

- WCAG 2.2: reflow should preserve information/functionality at a 320 CSS px viewport except for content that inherently requires two-dimensional layout.
- WCAG 2.2 SC 2.5.8: pointer targets have a 24 × 24 CSS px minimum with defined exceptions; SAMS intentionally uses larger touch-friendly controls for operational workflows.
- WAI-ARIA APG: native buttons should retain button semantics; toggle state should use \`aria-pressed\`; keyboard focus must remain visible and predictable; modal dialogs need contained focus and Escape handling.
- Apple Human Interface Guidelines (Layout): layouts should adapt consistently across display sizes, orientations, and contexts while preserving familiar relationships between controls and content.
- shadcn/ui: component variants and composition should be explicit and reusable rather than duplicated ad-hoc styles.

## Decisions

### Layout tokens

The shared CSS foundation now owns:

- application shell maximum width: 90rem;
- content maximum width: 72rem;
- admin sidebar width: 17rem;
- application sidebar width: 16rem;
- control radius: 0.5rem;
- surface radius: 0.75rem;
- elevated surface radius: 1rem;
- touch target baseline: 2.5rem;
- form control baseline: 2.75rem;
- responsive page gutters: 1rem → 1.5rem at 640px → 2rem at 1024px.

These are contracts, not instructions to force every component to use identical dimensions.

### Responsive behavior

The design system distinguishes:

- shell adaptation;
- content reflow;
- density changes;
- control sizing;
- navigation transformation;
- table/list transformation;
- deliberate horizontal scrolling for workflows whose meaning requires two dimensions.

We do not force two-dimensional scrolling on normal reading content merely to preserve a desktop layout.

### Shared components

Updated shared primitives now consume the design tokens for:

- Button;
- Input;
- Select;
- Dialog;
- Drawer;
- PageHeader;
- Table.

PageHeader actions stack naturally below the heading on narrow screens and return to a horizontal arrangement from 640px upward.

Table containers use a shared horizontal-scroll contract rather than repeating overflow behavior.

Dialogs and drawers use viewport-aware maximum widths so their width is constrained by the actual viewport before their desktop max-width.

### Accessibility

The existing semantic and keyboard behavior is preserved.

In particular:

- native \`button\` elements remain native;
- \`aria-pressed\` continues to represent toggle state;
- focus-visible indicators remain globally available;
- modal focus management remains delegated to the existing focus hook;
- mobile target sizing is not reduced below the established 40px interaction baseline;
- form inputs/selects retain a 44px minimum height.

## Validation completed

- TypeScript typecheck: PASS.
- Oxlint: PASS, 0 warnings / 0 errors.
- Vitest: PASS, 49/49.
- Production Vite build with \`/sams/\` base: PASS, 180 modules.
- Attendance reliability E2E: PASS, 12/12.
- Accessibility E2E: PASS, 7/7.
- Security E2E: PASS, 6/6.
- Responsive mobile E2E: PASS, 4/4.

The general E2E run must be interpreted carefully in the Codespace: Phase 23 production-integration tests require an Apache production mount and are not equivalent to the Vite dev server. The local run therefore produced environment-specific failures in those production tests. The targeted regression suite for the changed UI foundation passed except for two Phase 20 performance tests that inspect production chunk filenames while running against the Vite dev server; those failures are test-environment mismatches, not application runtime failures.

## Scope boundary

Phase 31 does not redesign Admin or Teacher pages yet.

It establishes the contracts those pages must follow.

Next phase: Phase 32 — Application Shell + Information Architecture.

