# SAMS Design Playbook
## Shared Visual DNA, Different Product Compositions

Date: 2026-10-06
Status: ACTIVE — implementation guidance

## 1. Core rule

SAMS must look like one product without making every page look like the same page.

Login is the current visual reference for SAMS brand identity. It is NOT a universal page-layout template.

Future pages must reuse the same visual DNA while choosing a composition appropriate to their task.

## 2. What stays consistent

- SAMS typography and Arabic typography configuration
- SAMS blue/cobalt/teal brand family
- neutral light application canvas
- white and near-white surfaces
- border-led separation
- controlled corner radii
- subtle elevation
- precise spacing rhythm
- accessible focus states
- explicit status communication
- calm motion
- RTL/LTR structural support

## 3. What must change by page

Do not blindly copy:
- complete layout
- column structure
- navigation placement
- hero section
- card arrangement
- exact spacing sequence
- information density
- decorative elements
- interaction pattern

Reuse components and visual rules; recreate the composition from the user's task.

## 4. Three design layers

### Identity
Shared across the whole product: typography, colors, radii, borders, shadows, controls, states, icons, motion.

### Workspace
Defines the product area: Public/Auth, Teacher, Admin, Counselor, System.

### Task composition
Defines the actual page: sign in, attendance, teacher management, onboarding review, student details, audit, reports, etc.

## 5. Color language

### SAMS brand family
- primary brand: #1477ad
- primary hover: #0d628f
- cobalt utility: #1d4ed8
- teal accent: #29c7d8
- deep brand navy: #123b73
- public canvas: #edf6fb
- public surface: #f8fcff
- public border: #b9d8eb

### Core neutrals
- background: #f5f5f5
- surface: #ffffff
- text: #171717
- muted text: #6b6b6b
- border: #d4d4d4

### Distribution
Most of the UI remains neutral.
Brand color is reserved for meaningful emphasis: active states, links, focus, selected navigation, primary public/auth emphasis, and important visual anchors.
Success, warning, danger, info, and excused remain semantic colors and are not replaced by brand blue.

## 6. Typography

Manrope remains the general UI font. Thmanyah Sans is used for Arabic RTL where configured.

Use size, weight, spacing, and position to create hierarchy before relying on color.
Operational pages favor compact readable hierarchy. Public/auth pages can be more expressive.

## 7. Spacing

Use the shared 4px rhythm:
4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48

8–12px = related items.
16px = component internals.
24px = task groups.
32px+ = major sections.

Consistency means using the same vocabulary, not forcing identical gaps on every page.

## 8. Shape and elevation

Preferred radius language:
- 6px controls
- 8px compact surfaces
- 12px major surfaces/dialogs
- pill shapes only when their shape communicates meaning

Use borders before shadows.
Stronger elevation is reserved for dialogs, drawers, popovers, menus, and other layered UI.

## 9. Page archetypes

### Public/Auth
Examples: Login, Teacher Onboarding, Onboarding Status, Activation.
Use stronger brand expression, calmer atmospheric backgrounds, clear entry/exit paths, and app-like mobile composition.

### Teacher Core
Examples: Attendance, Signatures, Class operations.
Task first. Minimal chrome. Persistent context. Fast actions. Dense but readable data. Strong selected/protected states.

### Teacher Information
Examples: Classes, Students, Reports.
Use PageHeader, contextual actions, filters, lists/tables/details according to the data shape.

### Admin Overview
Example: Admin Dashboard.
Prioritize operational overview, attention items, useful metrics, recent activity, quick actions, and academic-year context.

### Admin Management
Examples: Teachers, Students, Users, Classes, Academic Years, Onboarding.
Use search/filter/sort, result counts, dense tables or lists, focused dialogs/drawers, lifecycle controls, and explicit confirmations.

### Admin Operations
Examples: Imports, Archive, future Rollover.
Make process state, review, commit boundaries, historical context, and safe destructive behavior obvious.

### Audit/Security
Example: Audit.
Data first, low decoration, strong actors/timestamps/event semantics, predictable density.

### System
Examples: Not Found, Unauthorized, Route Error.
Simple SAMS identity, clear recovery action, no unnecessary application chrome.

## 10. Responsive composition

Responsive means redesigning composition, not shrinking desktop.

### Mobile
Prioritize task context, primary action, readable content, touch-safe controls, and deliberate horizontal scrolling only for genuinely two-dimensional workflows.

### Tablet
Use additional width for side-by-side filters, wider lists, contextual panels, or split detail when it improves the task.

### Desktop
Expose more simultaneous context and preserve efficient scanning. Avoid oversized cards and excessive empty space.

## 11. State language

Every meaningful interactive component should account for:
default, hover, focus, selected, disabled, loading, success, warning, error, empty, no-match, and protected/read-only where relevant.

State meaning must not depend on color alone.

## 12. Navigation

Navigation is a workspace concern, not a universal page template.

Admin, Teacher, Counselor, and Public/Auth may have different navigation structures while sharing the same visual language.

Navigation should communicate current workspace, current location, related destinations, and safe transitions.

## 13. Real-product rule

When researching similar products, extract design logic instead of copying branding.

Compare:
- hierarchy
- task flow
- density
- empty/loading/error states
- mobile transformation
- action prioritization

Then adapt the pattern to SAMS and its actual backend/product requirements.

## 14. Login reference boundary

Login establishes the visual DNA:
- SAMS palette
- logo treatment
- typography direction
- blue/teal atmosphere
- subtle motion
- clear hierarchy
- desktop/mobile identity

Login does not define the Admin layout, Teacher layout, management-table layout, or application navigation.

## 15. Page implementation rule

Before writing JSX, answer:

1. What is the user's primary task?
2. What context must remain visible?
3. What is scanned versus read?
4. What is the primary action?
5. Which states can interrupt the task?
6. What is the mobile composition?
7. What deserves visual emphasis?
8. Which shared components can be reused?
9. What must remain unique to this page?

Only then choose the composition.

## 16. Forbidden shortcut

Never say:
Make this page look exactly like Login for consistency.

Instead:
Use the same SAMS visual language, then choose the composition that best serves the task.

## 17. Target product feel

SAMS should feel like one carefully designed system with multiple purpose-built workspaces.

Not one template copied across every route.

Public/Auth = expressive brand identity.
Teacher = task-oriented professional workspace.
Admin = operational management workspace.
Counselor = focused read-only workspace.
Audit = evidence-first workspace.

## 18. Implementation order

1. Preserve the successful Login baseline.
2. Finish the public onboarding family with the shared visual DNA.
3. Audit AppShell before major Admin reconstruction.
4. Design Admin compositions from real tasks and backend contracts.
5. Establish shared management patterns.
6. Apply the system across Admin pages.
7. Reconcile Teacher/Counselor surfaces where useful.
8. Run cross-surface visual and responsive verification.

## 19. Source of truth

This playbook operationalizes the deeper decisions in:
- DESIGN_RD_PHASE_27_VISUAL_DIRECTION_AND_SAMS_DESIGN_LANGUAGE.md
- DESIGN_RD_PHASE_29_CROSS_SURFACE_CONSISTENCY.md
- DESIGN_SYSTEM_RESPONSIVE_FOUNDATION_2026-10-01.md

The deeper documents contain research and historical decisions. This playbook is the day-to-day implementation rulebook.

# SAMS Design Principle

Same SAMS DNA. Different composition.

Consistency comes from the system, not repetition.

## 20. Reference-derived design rules

The playbook is informed by the previously selected design references. Each reference is used for the part of design it is actually good at; no reference is treated as a template for SAMS.

### Refactoring UI — hierarchy, spacing, restraint
Use it to make interfaces clearer before making them prettier:
- establish hierarchy through size, weight, contrast, spacing, and position
- start with more space, then tighten deliberately
- use a real spacing and sizing system
- avoid filling the viewport just because space exists
- reduce unnecessary borders and visual noise
- de-emphasize secondary information so primary information becomes obvious
- design the feature first; let the layout follow the task

This is especially important for Admin and Teacher surfaces, where readability and scanning beat decoration.

### Impeccable — anti-generic product quality
Use it as a quality filter against generic AI-looking UI:
- every page needs a clear purpose and an intentional aesthetic direction
- vary spacing according to grouping and hierarchy; do not use one padding value everywhere
- do not put everything inside cards
- do not repeat identical metric-card grids without a real information need
- avoid decorative gradients, glows, glass effects, oversized icons, and generic shadows in the authenticated core
- not every action is primary; hierarchy between primary, secondary, and quiet actions must be visible
- empty states should explain what to do next
- responsive behavior should adapt the composition, not merely shrink it

### Refero — real-product pattern research
Use Refero primarily as a research library:
- study real product screens by page type, flow, pattern, and UI element
- compare information hierarchy, density, search/filter behavior, creation flows, dialogs, tables, navigation, and empty states
- when several real products solve the same task differently, prefer the pattern that best fits the SAMS role and data
- research is evidence for a design decision, not permission to copy another product

Refero currently organizes research around page types, flows, UX patterns, and UI elements, including dashboards, onboarding, tables, dialogs, tabs, sidebars, searching, and filtering.

### shadcn/ui + 21st — composable application UI
Use these references for production-oriented application patterns:
- navigation should be composable from workspace, groups, active state, secondary actions, and user/system actions
- sidebars need explicit desktop/mobile/collapsed states
- management screens need coherent shell + table/list + form/dialog systems
- tables should support the real interaction model: sorting, filtering, pagination, selection, inline actions, or responsive transformation only where needed
- components should be reusable primitives, not screenshots recreated page by page

The current shadcn sidebar guidance explicitly separates header, scrollable content, groups, menu items, badges/actions, footer, and mobile/collapsed behavior. 21st's current dashboard/table collections reinforce the same shell + data + interaction approach.

### GOV.UK Design System — task clarity and forms
Use GOV.UK as a UX discipline reference, not as a visual brand:
- a page should have a clear job; do not make users parse unnecessary content
- ask only for data that is actually needed and whose use is understood
- use navigation when the service contains multiple recurring tasks; avoid navigation when the journey is a focused end-to-end flow
- make process state, review, confirmation, errors, and recovery explicit
- preserve the school's own SAMS identity; never import GOV.UK branding or typography

This is particularly relevant to onboarding, account recovery, imports, approvals, and destructive operations.

### Realtime Colors — tokens before decoration
Use it to validate the SAMS palette and typography in context:
- test colors on real interface surfaces rather than judging isolated swatches
- distinguish text/background neutrals from primary, secondary, and accent roles
- keep the number of product colors deliberately limited
- validate contrast for text and controls
- define a type scale instead of picking font sizes ad hoc
- prefer semantic tokens so the same role always behaves consistently across pages

### Taste — aesthetic consistency without uniformity
Use it as a reminder that a product's perceived quality comes from a consistent taste across color, typography, density, and style:
- keep the SAMS personality stable
- allow different pages to express that personality through different compositions
- review pages as a family, not as isolated screenshots

### MotionSites — composition and first-viewport inspiration
Use it mainly for Public/Auth and selected product-facing surfaces:
- think about the first viewport as a deliberate composition
- establish hierarchy before adding decorative sections
- use visual proof and supporting context only when they support the page goal
- do not import marketing-style composition into dense Admin/Teacher workflows

### Spline — experiential motion, used selectively
Spline is a reference for interactive visual depth, responsive spatial behavior, and motion—not for the structural design of SAMS management screens.
Use such techniques only when they improve orientation, branding, or feedback and do not compete with operational data.

### Make Interfaces Feel Better — motion budget
Treat motion as a limited product resource:
- high-frequency interactions should feel nearly instant
- prefer subtle opacity/background/border transitions for repeated interactions
- motion must not be the only feedback channel
- respect prefers-reduced-motion
- reserve stronger transitions for meaningful state changes, navigation, overlays, or onboarding moments

### Reference hierarchy inside SAMS
When sources disagree, use this order:
1. SAMS product requirements, accessibility, and real user task
2. SAMS design tokens and shared component rules
3. Refactoring UI / Impeccable for hierarchy, spacing, restraint, and quality
4. Refero / GOV.UK for task flows and information architecture
5. shadcn / 21st / Origin UI / Lightswind for component and responsive patterns
6. Realtime Colors for palette/type validation
7. MotionSites / Spline / motion references for expressive surfaces and motion only

The rule is simple:

**Borrow the decision logic. Rebuild the composition for SAMS.**

