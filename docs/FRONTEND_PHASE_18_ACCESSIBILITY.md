# SAMS — Frontend Phase 18 — Accessibility

Status: PASS — 2026-09-29

## Objective

Run an accessibility engineering pass over the reconstructed frontend after the responsive foundation was closed, without changing server-authoritative business behavior or starting visual redesign.

Scope:

- semantic interactive controls;
- keyboard navigation;
- focus management;
- dialog accessibility;
- attendance state semantics;
- form and control naming;
- status messaging;
- touch target sizing;
- contrast;
- reduced motion;
- RTL/LTR behavior;
- automated accessibility checks;
- regression safety.

## ECC findings and fixes

### Finding 1 — dialogs/drawers did not contain keyboard focus

RED: the shared Dialog and Drawer primitives moved focus into the surface, but Tab could leave the modal surface and focus was not restored to the invoking control after close.

Fix:

- added 'frontend/src/components/ui/useModalFocus.ts';
- shared primitive traps Tab/Shift+Tab within the open surface;
- Escape remains a close action;
- initial focus moves to the first focusable control;
- focus is restored to the previously focused element when the surface closes;
- both Dialog and Drawer use the same primitive.

The current application has no active Drawer consumer; the Drawer primitive was statically reviewed and now shares the same focus implementation.

### Finding 2 — attendance day controls used incomplete tab semantics

RED: attendance day controls used role=tab and aria-selected without an associated tabpanel.

Fix:

- day controls are native buttons with aria-pressed;
- the control strip is a named group;
- period/filter selections continue to expose pressed state;
- filter buttons now expose aria-pressed.

This removes incomplete ARIA tab semantics without changing attendance behavior.

### Finding 3 — muted text failed AA contrast on the application background

RED: automated axe reported #737373 on #f5f5f5 at 4.34:1, below the 4.5:1 normal-text threshold used by the automated check.

Fix:

- changed --sams-muted from #737373 to #6b6b6b;
- the shared token fix covers existing muted text consistently rather than adding one-off overrides.

### Finding 4 — small search clear control needed a stronger touch target

Fix:

- shared Search clear control now uses a minimum 40px height and width;
- focus-visible styling is explicit.

### Finding 5 — session loading boundaries exposed no status semantics

Fix:

- authenticated and public route loading boundaries now expose role=status and aria-live=polite.

## Forms, tables and status semantics

Reviewed:

- FormField label association and generated IDs;
- aria-describedby / aria-invalid propagation;
- table captions and scope=col headers;
- button naming;
- status/alert feedback;
- attendance selected, signed, disabled and save-related state semantics;
- navigation active-state semantics through React Router NavLink;
- RTL/LTR document language and direction handling.

## Reduced motion

Existing global reduced-motion support was retained and verified in-browser:

- prefers-reduced-motion: reduce;
- transition duration is reduced;
- animation duration and iteration count are reduced;
- scroll behavior is disabled for motion-sensitive users.

## Verification

### Dedicated Phase 18 E2E

'tests/e2e/frontend_phase18_accessibility.spec.js'

7/7 PASS.

Coverage:

- teacher shell active-page semantics and named controls;
- keyboard focus trap + Escape + focus restoration for dialogs;
- attendance selection semantics;
- automated axe scan on teacher workspace;
- automated axe scan on attendance at desktop and mobile viewport sizes;
- login accessibility scan and authentication control naming;
- reduced-motion behavior.

### Axe

Automated scans completed with:

- 0 violations on teacher workspace;
- 0 violations on attendance desktop;
- 0 violations on attendance mobile;
- 0 violations on login.

### Regression

Combined frontend regression:

- Phases 12–17 + Phase 18: 34/34 PASS.

A Phase 12 test that expected the old role=tab semantics was updated to assert the new, correct button semantics after the accessibility change. No business behavior was changed.

### Static gates

- TypeScript: PASS
- Oxlint: 0 warnings / 0 errors
- Vite production build: PASS
- git diff --check: PASS

## Scope boundary

Phase 18 does not:

- redesign the product;
- start Design R&D;
- introduce branding;
- change backend business rules;
- change authorization;
- change tenant boundaries;
- rewrite closed feature phases.

The accessibility work is targeted at semantics, interaction, feedback, contrast and inclusive operation.

## Gate

PASS.

📍 Current project state: Official frontend Phases 1–18 are PASS. Phase 19 — Frontend Security Review is next.
