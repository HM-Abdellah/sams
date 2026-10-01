# SAMS — Design R&D Phase 25
## Web + Educational Product Research

Date: 2026-09-30
Status: PASS — research gate
Scope: research only; no runtime application behavior changed

## Objective

Establish an evidence-based UX/design direction before Figma construction.
The research follows the project rule: learn from products and patterns, never copy another product's identity.

Primary workflow under test:

**Teacher Attendance / Feuille de présence**

Primary device priority:

**Mobile first**, with desktop optimized for high-density scanning.

## Research method

1. Inspect current SAMS workflow, information architecture, responsive constraints, and semantic tokens.
2. Review current educational-product navigation and attendance patterns.
3. Review design-system and component-distribution references.
4. Extract reusable patterns, trade-offs, and constraints.
5. Convert observations into SAMS-specific design decisions.
6. Reject ideas that add visual novelty without reducing task cost.

## Product research: Google Classroom

Current Google Classroom guidance describes a role-personalized homepage and a layout where users can collapse or expand modules. Classroom therefore prioritizes role relevance and controllable information density rather than exposing every capability at once.

SAMS implication:
- role-aware navigation should expose the teacher's operational destinations first;
- secondary information can remain available without competing with attendance;
- dense workflows need clear grouping rather than many unrelated cards.

Reference: Google Classroom Help, "Navigate your Classroom Homepage".

## Product research: Canvas Teacher

Current Canvas Teacher documentation shows a mobile-first teacher workflow around Courses/Dashboard, course navigation, and an Attendance tool designed for mobile roll call. The attendance flow exposes the current date, student list, filtering, per-student status, and a bulk action to mark all or remaining students present.

SAMS implication:
- mobile attendance must be a first-class workflow rather than a compressed desktop table;
- the current working context should remain visible while marking students;
- bulk actions are useful when they reduce repeated taps without hiding individual control;
- filters belong close to the roster because they change the active set.

Reference: Instructure, Canvas Teacher Android/iOS attendance and navigation guides.

## Product research: Moodle

Current Moodle 5.2 documentation describes a dashboard centered on Course overview and Timeline, with Calendar in the block drawer. Moodle 5.0 also introduced an Activities overview that organizes course activities by type and surfaces operational metadata for teachers.

SAMS implication:
- an overview surface should summarize work, not become a second operational screen;
- navigation and overview information should remain structurally separate;
- metadata should be exposed when it supports a decision, not merely because it exists.
## Cross-product navigation findings

Across the educational products reviewed, the useful recurring pattern is not a specific sidebar or card style. It is the separation of:

**global context → course/class context → task surface → local controls**

For SAMS this becomes:

**SAMS shell → teacher/class context → attendance workspace → day/period → roster controls**

This supports the existing SAMS information architecture without importing another product's visual identity.

## Mobile findings

The strongest mobile signal comes from the fact that modern teacher products treat navigation and attendance as task-specific mobile flows rather than simply shrinking desktop layouts. Canvas explicitly documents mobile attendance as a dedicated teacher workflow.

SAMS design consequence:

- class + week must be visible before the roster;
- day selection must be easy to scan horizontally;
- period selection must remain tappable without becoming a miniature dense table;
- search and filters should be reachable without losing the selected context;
- each student record should expose the attendance action directly;
- routine actions should avoid dialogs when inline interaction is sufficient.

## Data-density findings

Attendance is a repetitive operational task. The visual system therefore needs controlled density rather than dashboard-style spaciousness.

Use:
- strong row rhythm;
- compact but comfortable controls;
- clear alignment;
- persistent context;
- restrained borders and surfaces;
- predictable status controls.

Avoid:
- giant student cards;
- decorative KPIs competing with the roster;
- nested card stacks;
- excessive icon-only actions;
- animated transitions between every attendance state.

## Status and feedback findings

Attendance has meaningful state transitions: unmarked, present, absent, late, excused, saved, saving, failed, signed, and needs-resign.

Design consequence:

Status must be communicated through more than hue. Combine label, iconography, shape, position, or explicit text with color where appropriate. Feedback must explain what changed and what the teacher can do next.

Operational feedback should look like system feedback, not marketing or promotional content.

## Component-system research: shadcn/ui

shadcn/ui currently describes itself as an open-code component distribution approach with composable, accessible components. Its current catalog includes primitives relevant to SAMS such as Button, Data Table, Dialog, Drawer, Select, Table, Tabs, Toast, Toggle, and Tooltip.

SAMS implication:
- borrow compositional patterns where they fit the existing architecture;
- keep component source local and inspectable;
- do not replace working SAMS primitives merely because an external component exists;
- accessibility behavior remains a design requirement, not an afterthought.

The current shadcn approach also reinforces a key project rule: a component catalogue answers what exists, while product-specific judgement determines whether it belongs in SAMS.
## Component-catalogue research

21st.dev is useful as a broad catalogue of React/shadcn patterns, especially for comparing multiple implementations of tables, navigation, command surfaces, and higher-polish interactions. The catalogue should be treated as a search space, not as the SAMS architecture.

React Bits, Componentry, and Skiper remain useful reference/registry sources for motion and interaction experiments. Their role is constrained by the attendance workflow: motion cannot increase interaction cost or reduce clarity.

Lightswind is retained for application-shell and data-heavy layout references. GetLayers, OriginKit, Manus, MotionSites AI, Spline, Refero, and Realtime Colors remain active for their specific research strengths as established in the source matrix.

## Research-source principle

No single source is allowed to define SAMS.

The working model is:

**Product research** → validates task patterns
**Design-system research** → validates reusable UI mechanics
**Motion research** → validates feedback quality
**Visual research** → expands the range of considered directions
**SAMS constraints** → decide what actually ships

## Visual-language guardrails

Research reinforces the existing SAMS direction:

- calm;
- clear;
- professional;
- efficient;
- distinctive without spectacle.

Do not import:
- gaming aesthetics;
- neon-heavy palettes;
- excessive gradients;
- excessive glassmorphism;
- giant decorative surfaces;
- dashboard-template ornamentation.

These are guardrails, not an aesthetic ideology. Any exception must demonstrate a concrete UX, hierarchy, branding, or accessibility benefit.

## Preliminary SAMS design decisions

### Decision 1 — Mobile attendance is the reference system

Build the Teacher Attendance screen first at approximately 390px, then derive the desktop composition from the same task model.

### Decision 2 — Context stays persistent

Class + week + current day/period context should remain discoverable while the teacher works through the roster.

### Decision 3 — Attendance is an operational workspace

Do not frame the main surface as a dashboard. Overview information should remain subordinate to the attendance task.
### Decision 4 — Status controls are primary interaction components

Attendance controls need a complete state model: default, hover/focus, pressed/selected, disabled, saving, error/retry, and protected/signed states where applicable.

### Decision 5 — Density is intentional

The roster should be dense enough for rapid scanning while preserving touch comfort and readable typography. Whitespace will separate task groups, not inflate every individual record.

### Decision 6 — External components are ingredients, not architecture

External registries and MCP catalogues can accelerate exploration and provide tested patterns, but SAMS keeps ownership of its component contracts, accessibility semantics, and feature boundaries.

### Decision 7 — Figma is the visual system, not the business authority

Figma will encode visual structure, tokens, components, states, and responsive behavior. API semantics, permissions, tenant boundaries, and attendance truth remain in the application/backend.

## Open research questions for the next phase

1. What exact mobile navigation model minimizes repeated context switching?
2. Which day/period controls provide the clearest selected state under RTL and LTR?
3. Which attendance status control pattern minimizes mis-taps during repeated entry?
4. How should save-state feedback occupy the mobile viewport without becoming sticky visual noise?
5. Which motion moments materially improve confidence after a mutation?
6. Which typography/spacing scale gives the best scanability at 390px and 1440px?
7. Which Figma community/library primitives can be adapted without fighting SAMS semantics?

## Evidence sources

- Google Classroom Help — Navigate your Classroom Homepage.
- Instructure Community — Canvas Teacher Android/iOS navigation and attendance guides.
- MoodleDocs — Dashboard 5.2 and Activities overview 5.0.
- shadcn/ui official documentation — component philosophy and current component catalogue.
- Refero — real product screens and flow research.
- 21st.dev — community component catalogue and MCP guidance.

## Phase 25 exit criteria

- Educational product research completed.
- Mobile attendance patterns explicitly analyzed.
- Navigation/context/data-density patterns extracted.
- Status and feedback requirements extracted.
- External source roles preserved.
- SAMS-specific design decisions written down.
- Open questions defined for the next research phase.
- No runtime/business logic changes introduced.

**PHASE 25 — PASS**

Next: **PHASE 26 — UX Interaction + Responsive Pattern Research**.
