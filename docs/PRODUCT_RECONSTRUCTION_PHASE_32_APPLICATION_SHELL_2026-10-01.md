# SAMS — Phase 32: Application Shell + Information Architecture

Date: 2026-10-01
Branch: reconstruction/product-system-2026-10-01

## Goal

Create one coherent application shell for Admin, Teacher, and Counselor so the user always knows:

- which workspace they are in;
- which destination is active;
- where related tasks live;
- how to navigate on desktop, touch, and keyboard.

This phase changes the application shell/navigation only. Product capabilities and backend contracts remain unchanged.

## Explore

Repository evidence reviewed:

- frontend/src/routes/route-config.ts
- frontend/src/routes/router.tsx
- frontend/src/components/layout/AppShell.tsx
- frontend/src/components/ui/Drawer.tsx
- frontend/src/components/ui/useModalFocus.ts
- frontend/src/pages/app/WorkspaceLandingPage.tsx
- teacher/admin/counselor page headers and existing route destinations
- i18n translation keys and dictionaries
- Phase 30 workflow reconciliation and Phase 31 responsive foundation

Before Phase 32, Admin already had grouped desktop navigation, while Teacher/Counselor used the same standard navigation implementation. At narrow widths that implementation became a horizontally scrollable navigation strip. This preserved access, but did not provide a stable application hierarchy on mobile.

No backend route or permission contract was added during this phase.

## Research

Research focused on real product navigation and responsive shell patterns rather than decorative UI:

- Refero emphasizes real product screens and indexes sidebar/drawer, navigation bar, toolbar, dashboard, and workflow patterns.
- shadcn/ui documents a composable sidebar model with grouped menus, active states, responsive off-canvas behavior, and RTL support.
- 21st.dev guidance highlights grouped primary destinations, active items, responsive layouts, and account/workspace areas separated from the primary link list.
- Lightswind provides responsive navigation examples covering sticky navigation, collapsible sidebars, and mobile drawers.
- React Bits includes vertical side navigation and mobile drawer patterns.
- Spline's dashboard separates persistent sidebar navigation from workspace/context controls; SAMS does not need a workspace switcher because this release has one institutional workspace.
- GetLayers and MotionSites are useful for visual craft/motion references, but this phase deliberately avoids ornamental motion and cinematic effects because SAMS is an operational school system.
- Refero Styles reinforces explicit design-system decisions for colors, typography, spacing, and component behavior rather than ad-hoc styling.

References:

- https://refero.design/
- https://styles.refero.design/
- https://ui.shadcn.com/docs/components/base/sidebar
- https://21st.dev/community/components/explore/sidebar-ui
- https://21st.dev/blog/react-sidebar-component-examples
- https://www.lightswind.com/blocks/navigation
- https://pro.reactbits.dev/docs/blocks/navigation
- https://docs.spline.design/basics/understanding-splines-ui
- https://getlayers.ai/
- https://motionsites.ai/

## Decide

### 1. Information architecture is route-owned

Each app route now declares an optional navigation section. The route list remains the canonical list of destinations; the shell only groups those destinations.

This prevents the shell from inventing navigation targets that the router/backend does not expose.

### 2. Admin hierarchy

Admin navigation remains operationally grouped:

- Overview
  - Dashboard
- People / reference data
  - Classes
  - Teachers
  - Users
  - Onboarding
- Operations
  - Academic years
  - Imports
  - Archive
  - Audit

### 3. Teacher hierarchy

Teacher navigation is grouped around the real work journey:

- Workspace
  - Teacher home
  - My classes
  - Attendance
- Records
  - Students
  - Signatures
  - Reports

The class detail route /app/classes/:classId stays under the Classes destination. It does not become a new top-level navigation item.

The shell intentionally does not add a standalone Collaboration destination. Shared work is a capability of the class/attendance workspace and will be implemented in later phases.

### 4. Counselor hierarchy

Counselor currently exposes only the capability that exists in the router/backend-backed frontend:

- Counselor workspace

No speculative class/attendance/report destinations are introduced in this phase.

### 5. Responsive navigation contract

Desktop (lg and above):

- persistent sidebar;
- role-specific grouping;
- active route remains visible;
- sidebar navigation scrolls independently;
- account/workspace context remains above the navigation links.

Below lg:

- no wide navigation strip;
- navigation is opened in an accessible drawer;
- navigation closes after selecting a destination;
- Escape closes the drawer;
- focus is trapped in the drawer while open and returns to the trigger on close;
- the trigger exposes aria-expanded, aria-controls, and a localized accessible name.

### 6. Header/context contract

The global header now carries only high-value context:

- SAMS identity;
- current top-level destination;
- language selector;
- sign-out.

The current destination is derived from the longest matching route, so /app/classes/:classId still announces Classes.

Academic-year, date, class, period, and subject context remains page/workflow-specific because the current global session model does not expose a single server-authoritative context for all roles.

### 7. Content width

The shell applies the Phase 31 --sams-content-max contract to the main content column while preserving the shared page gutters.

### 8. Visual language

The shell uses the existing SAMS semantic tokens and restrained enterprise patterns:

- no new gradient system;
- no decorative 3D/illustration layer;
- no motion-heavy navigation;
- no arbitrary new colors;
- existing active, warning, focus, and surface semantics are preserved.

## Constructed Changes

### frontend/src/routes/route-config.ts

Added:

- optional section metadata to AppRouteDefinition;
- Teacher/Admin/Counselor section assignments;
- AppNavigationSection;
- navigationSectionsForRole().

### frontend/src/components/layout/AppShell.tsx

Rebuilt the shell around the route-owned IA:

- role-aware persistent desktop sidebar;
- accessible mobile drawer;
- route-derived current destination label;
- shared navigation renderer for desktop and mobile;
- active state retained for nested routes;
- attendance pending-work indicator retained;
- independent sidebar scroll behavior;
- header height uses the shared --sams-app-header-height token;
- main content uses --sams-content-max.

### frontend/src/features/i18n/types.ts

Added localized keys for:

- open navigation;
- close navigation;
- workspace section;
- records section.

### frontend/src/features/i18n/dictionary.ts

Added French, Arabic, and English translations for the new navigation labels/actions.

### frontend/src/styles/global.css

Added:

- --sams-app-header-height: 4.25rem.

## Verification Plan

Run:

1. TypeScript validation.
2. Oxlint.
3. Vitest.
4. Production Vite build.
5. Existing mobile/accessibility/attendance/security E2E suites.
6. Visual/browser checks at:
   - 320px
   - 390px
   - 768px
   - 1024px
   - 1280px
   - 1440px+

Phase 32 exit criteria:

- desktop navigation is persistent and role-aware;
- mobile navigation is drawer-based and keyboard accessible;
- active destination is clear;
- nested class routes resolve to the correct active parent;
- no route capability is invented;
- existing attendance pending-work protection remains intact;
- shared responsive tokens remain the styling authority.

## Scope Boundary

Deferred to later phases:

- Admin operational dashboard redesign (Phase 33);
- Admin relationship/workspace reconstruction (Phases 34–35);
- Teacher Home/Class Workspace redesign (Phase 36);
- Attendance collaboration/concurrency (Phase 38);
- global academic-year/context infrastructure;
- PWA/offline navigation (Phases 45–47).

## ECC Status

- Explore: complete
- Research: complete
- Decide: complete
- Construct: complete
- Verify: complete
- Document: complete
- Git-check: in progress
- Close: pending