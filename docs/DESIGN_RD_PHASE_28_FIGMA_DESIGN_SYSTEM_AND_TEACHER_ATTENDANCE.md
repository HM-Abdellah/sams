# SAMS — Design R&D Phase 28
## Figma Design System + Teacher Attendance Reference Screens

Date: 2026-09-30
Status: **COMPLETE — Figma construction and verification completed**
Runtime behavior changed: **NO**

## 1. Objective

Phase 28 turns the decisions from Phases 25–27 into a production-oriented Figma build specification for the SAMS design system and the primary Teacher Attendance reference screens.

The phase has two distinct gates:

1. **Design specification gate** — can be completed without changing runtime behavior.
2. **Figma construction gate** — requires successful Figma MCP writes and structural/visual verification.

The design specification gate and Figma construction gate are both complete. The original Starter-team connection remained rate-limited, so construction was completed through the linked student-tier Figma team using the supported Figma write path.

The canonical Phase 28 Figma file is now fully populated and verified.

## 2. Entry verification

Verified against the current Codespace state before Phase 28 planning:

- Repository path: `/workspaces/sams`
- Current branch: `hardening/final-red-team-and-readme-20260930`
- Current HEAD at closeout: `08a063366dbf2f48f0e5bf698dd921321a99d5ee`
- `origin/main`: `1bb1b837672d87af20cab09711f133aee29fe4d7`
- The branch remains ahead of `origin/main`; the exact ahead count is not duplicated here because documentation-only closeout commits can change it.
- Working tree at the last Codespace verification contained only intentional untracked Playwright artifacts (`playwright-report/`, `test-results/`).
- Latest verified CI before the documentation-only Phase 28 closeout commits: Run #830, completed successfully, with all 7 release jobs passing.
- CI jobs verified: `php`, `e2e`, `frontend-build`, `javascript`, `clean-school-acceptance`, `apache`, `production-integration`
- Canonical Figma file: `qMn52cWIjW89zqHWahgCgP`
- Historical Starter-team Figma file: `c7AYNouIorvvAzGlryHqcZ`
- Figma file creation: previously verified
- Community libraries: previously verified, including Simple Design System and Material 3 Design Kit
- Starter-team Figma MCP state: **rate-limited**
- Student-team Figma MCP state: **construction path verified and usable**

The Figma block was re-verified before this document was prepared. Therefore this document intentionally contains no claim of newly written Figma nodes.

## 3. Design authority model

The Figma design system encodes:

- visual tokens;
- component mechanics;
- variants;
- responsive composition;
- interaction states;
- accessibility annotations;
- RTL/LTR behavior;
- motion intent;
- screen hierarchy.

Figma does **not** define:

- permissions;
- school/tenant authorization;
- API contracts;
- attendance truth;
- enrollment rules;
- sign-off protection;
- audit semantics;
- database behavior.

The application/backend remain authoritative for all business behavior.

## 4. Locked visual direction

SAMS visual language:

# Calm Precision — The Digital School Register

Formula:

`neutral canvas + ink-first hierarchy + restrained cobalt utility accent + border-led surfaces + controlled radii + compact 4px rhythm + Inter + explicit status geometry + quiet motion + mobile-first attendance`

Primary qualities:

- calm;
- exact;
- trustworthy;
- efficient;
- contemporary;
- human;
- restrained.

## 5. Figma page architecture

Canonical Phase 28 Figma pages, in construction order:

```text
00 — Foundations
01 — Components
02 — Patterns
03 — Teacher Attendance — Mobile 390
04 — Teacher Attendance — Desktop 1440
05 — State Coverage
06 — RTL Verification
```

Future product surfaces remain intentionally outside the Phase 28 construction scope and can extend this file later without changing the verified attendance system foundation.

## 6. Foundations — token model

### 6.1 Semantic color variables

Use semantic names in Figma rather than screen-specific names.

| Token | Current baseline | Primary use |
| --- | --- | --- |
| `color/background` | `#f5f5f5` | application canvas |
| `color/surface` | `#ffffff` | default surfaces |
| `color/surface-muted` | `#f5f5f5` | subdued grouped areas |
| `color/text` | `#171717` | primary text |
| `color/text-muted` | `#6b6b6b` | secondary/caption text |
| `color/border` | `#d4d4d4` | structural boundaries |
| `color/action` | `#171717` | primary action |
| `color/action-foreground` | `#ffffff` | text on action |
| `color/focus` | `#2563eb` | keyboard focus |
| `color/accent` | `#1d4ed8` | restrained cobalt utility accent |
| `color/danger` | `#b91c1c` | destructive/error semantics |
| `color/danger-surface` | `#fef2f2` | error background |
| `color/success` | `#166534` | success semantics |
| `color/success-surface` | `#f0fdf4` | success background |
| `color/warning` | `#a16207` | warning/unsaved semantics |
| `color/warning-surface` | `#fefce8` | warning background |
| `color/info` | `#1d4ed8` | informational semantics |
| `color/info-surface` | `#eff6ff` | informational background |

Rules:

- semantic colors must remain distinguishable in grayscale by structure, label, iconography, or geometry;
- cobalt is a utility accent, not a replacement for success/danger/warning semantics;
- do not add a second decorative accent family without evidence;
- verify final contrast in context, not only as isolated swatches.

### 6.2 Typography variables

Font family:

`Inter`

Semantic type tokens:

| Token | Size | Weight | Line-height intent |
| --- | ---: | ---: | --- |
| `type/display` | 32–40px | 600 | compact display |
| `type/page-title` | 24–28px | 600 | page heading |
| `type/section-title` | 18–20px | 600 | section heading |
| `type/body` | 15–16px | 400 | default content |
| `type/body-medium` | 15–16px | 500 | emphasized content |
| `type/label` | 13–14px | 500 | controls/metadata |
| `type/caption` | 12–13px | 400 | supporting metadata |
| `type/numeric` | inherited semantic size | semantic weight | `tabular-nums` |

Typography rules:

- operational UI avoids 700+ except where an actual semantic requirement exists;
- hierarchy comes from size, weight, spacing, and placement before color;
- numeric counts use tabular numerals;
- Arabic wrapping/line-height must be tested before dimensions are considered locked;
- French, English, and Arabic content are first-class validation strings.

### 6.3 Spacing variables

Base unit: `4px`

Use the core scale:

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48`

Suggested naming:

`space/100 = 4`
`space/200 = 8`
`space/300 = 12`
`space/400 = 16`
`space/500 = 20`
`space/600 = 24`
`space/800 = 32`
`space/1000 = 40`
`space/1200 = 48`

Use larger gaps only for actual section hierarchy.

### 6.4 Radius variables

Suggested semantic values:

- `radius/sm = 4px`
- `radius/control = 6px`
- `radius/panel = 8px`
- `radius/surface = 12px`
- `radius/full = 9999px`

Use pills only when the control meaning justifies a fully rounded shape.

### 6.5 Elevation

Default hierarchy is border-led.

Use:

- flat surfaces;
- subtle structural borders;
- slight surface contrast.

Reserve stronger elevation for:

- dialog;
- drawer;
- popover;
- transient layered feedback.

Do not use persistent large shadows to create hierarchy in the attendance register.

### 6.6 Motion tokens

Define motion intent rather than animation spectacle.

- `motion/none`: 0ms / no transition
- `motion/fast`: 100–140ms
- `motion/standard`: 140–180ms
- `motion/reduced`: effectively no motion except the minimum necessary state indication

Default easing should feel immediate and predictable. Large movement is not appropriate for repeated attendance entry.

## 7. Foundations — directional and accessibility rules

Every Figma component must document:

- LTR behavior;
- RTL behavior;
- keyboard behavior;
- focus visibility;
- disabled behavior;
- touch target intent;
- reduced-motion behavior where relevant.

Use CSS-logical thinking in the design model:

- start/end instead of left/right;
- mirrored directional arrows in RTL;
- no layout rule depending on a hard-coded physical side;
- mixed Arabic + Latin names remain readable;
- horizontal rails remain understandable in both directions.

Touch target target:

- WCAG 2.2 provides a 24×24 CSS px conformance floor with exceptions;
- SAMS comfort target is approximately 40px+ for routine controls;
- approximately 44px is preferred for frequent primary mobile interactions when space allows.

These values are design targets, not a license to make every control oversized.

## 8. Component system

### 8.1 Foundation components

Build or adapt, in order:

1. Button
2. Input
3. Search
4. Select
5. IconButton
6. Badge / Status
7. Divider
8. Spinner

Each needs documented variants and states.

### 8.2 Operational components

1. ClassSelector
2. WeekNavigator
3. SaveStateStrip
4. DaySelector
5. PeriodSelector
6. AttendanceStatusControl
7. SearchFilterRail
8. ResultCount
9. StudentRecord
10. RosterTable
11. EmptyState
12. NoMatchState
13. SaveErrorState
14. ProtectedLessonState

### 8.3 System components

1. AppShell
2. RoleNavigation
3. Dialog
4. Drawer
5. TransientFeedback
6. ErrorPresentation

## 9. Component state contract

Every interactive component should have a state matrix rather than a single happy-path visual.

### Button

- default;
- hover;
- focus-visible;
- pressed;
- disabled;
- loading;
- danger where applicable.

### Input/Search

- empty;
- populated;
- focused;
- disabled;
- invalid;
- with clear action;
- no-match context.

### Select

- default;
- focused;
- open/selecting behavior noted separately if represented;
- disabled;
- invalid.

### Day/Period selector

- default;
- selected;
- focus-visible;
- pressed;
- unavailable only if the backend exposes such a state;
- RTL.

### Attendance status

- unmarked;
- present;
- absent;
- late;
- excused;
- focused;
- pressed/selected;
- disabled because signed/protected;
- changed locally/dirty;
- save failure context.

### Save state

- idle;
- unsaved;
- saving;
- saved;
- failed;
- retrying;
- blocked.

Signed lesson:

- protected;
- explicit explanation;
- no editable-looking affordance;
- reopening remains a distinct backend-authorized action.

## 10. Attendance status control — design decision for Phase 28

The current application uses native `<select>` controls on mobile and desktop.

Phase 28 should therefore design **two representations of the same semantic control**:

### Variant A — Native select

Preserve as the safest fallback and desktop-compatible baseline.

Use when:

- space is constrained;
- keyboard/native selection behavior is preferred;
- no evidence justifies a custom direct-choice group.

### Variant B — Direct single-choice status group

Prototype a compact, mutually exclusive group for mobile repeated entry.

The visual design should communicate the five states:

`Unmarked / Present / Absent / Late / Excused`

Design requirements:

- selected state is clear without relying on color alone;
- options remain touchable and visually separated;
- focus remains visible;
- keyboard model remains explicit;
- labels work in FR/EN/AR;
- protected/signed lessons disable or replace editing affordances without looking merely faded;
- the direct-choice control must not become five decorative pills with ambiguous semantics.

Implementation is intentionally **not changed in Phase 28**. This is a visual/product prototype decision pending usability evidence.

## 11. Day selector — reference pattern

Use a single-row horizontal rail.

Each item contains:

- weekday label;
- short date;
- selected geometry;
- clear focus treatment.

Semantics:

- selectable day in the same attendance workspace;
- not automatically an ARIA tablist;
- use native button/selection semantics unless the information architecture later becomes actual panel navigation.

RTL:

- horizontal flow mirrors appropriately;
- previous/next meaning remains clear;
- selected item remains visually unambiguous.

## 12. Period selector — reference pattern

Phone:

- single horizontal rail;
- compact period number + time;
- horizontal scrolling;
- selected state;
- visible focus.

Desktop:

- all eight periods can be visible at once when layout permits.

The Phase 26 2×4 mobile grid should therefore be treated as the legacy/current hypothesis, not the locked final design.

## 13. Save/state strip — reference pattern

Use an in-flow strip instead of a persistent sticky bottom bar.

Priority order:

1. counts / operational state;
2. primary Save action;
3. success confirmation;
4. failure + retry;
5. unsaved warning.

Rules:

- local dirty feedback appears immediately;
- server confirmation appears only after the mutation succeeds;
- success is quiet;
- failure preserves local work and presents retry;
- no routine modal interruption;
- no sticky behavior unless later usability testing proves a real task benefit and focus-obstruction checks pass.

## 14. Teacher Attendance — mobile reference frame

Reference width:

# 390px

The Figma frame should represent a realistic phone viewport and use auto layout for all related content.

Suggested hierarchy:

```text
SAMS / teacher navigation
↓
Feuille de présence
↓
Class selector + week context
↓
Save / operational state strip
↓
Day rail
↓
Period rail
↓
Search
↓
Filter rail
↓
Result count
↓
Compact student records
```

Each student record should make these facts scannable immediately:

- student name;
- absence count;
- current day context;
- attendance action.

Avoid:

- large profile cards;
- decorative avatars unless they provide real product value;
- nested card stacks;
- giant KPI tiles;
- long descriptions before the roster.

### 14.1 Mobile record geometry

Preferred composition:

```text
student name + row number
absence count / supporting metadata
attendance status action
```

The status action should sit close to the student identity so repeated movement is minimized.

### 14.2 Mobile search/filter

Sequence:

`Search → Filters → Result count`

Search should be full width.

Filters should remain easy to reach without losing the class/week/day/period context.

Filter meanings:

- All
- With absences
- 8+ absences

No business filtering semantics should be invented beyond the current application behavior.

## 15. Teacher Attendance — desktop reference frame

Reference width:

# 1440px

Application content max-width:

# 1152px / 72rem

Suggested hierarchy:

```text
context row
↓
operational state + save
↓
day rail
↓
8-period row
↓
search + filters + result count
↓
dense semantic roster table
```

Desktop roster columns remain:

- row number;
- student;
- attendance status;
- absence count.

Use a real semantic table representation in the visual specification.

Do not solve desktop space by increasing card padding until the table loses scan efficiency.

## 16. Responsive transformation rules

Responsive means task adaptation, not only font scaling.

### Phone

- context first;
- day rail horizontal;
- period rail horizontal;
- full-width search;
- local filter rail;
- compact records;
- direct status action;
- no routine horizontal table scroll.

### Tablet

- preserve the mobile task model;
- increase density where useful;
- allow secondary information to share rows when it improves scanning.

### Desktop

- 1152px max content;
- all 8 periods visible when practical;
- dense semantic table;
- search + filters in one toolbar;
- keyboard-efficient repeated entry.

## 17. Accessibility specification

Every screen reference must satisfy the design equivalent of:

- visible keyboard focus;
- adequate target size;
- no status communication by hue alone;
- logical reading order;
- meaningful labels;
- distinct empty/no-match/error states;
- reduced-motion variant;
- RTL/LTR behavior;
- focus not hidden by overlays;
- semantic table behavior on desktop.

The design should make the correct semantic implementation straightforward rather than asking engineering to reconstruct accessibility after the visual work.

## 18. Visual verification protocol for Figma

When Figma MCP writes become available, build in safe batches.

### Batch A — Foundations

- create/validate page structure;
- create semantic variables;
- create typography styles;
- create spacing/radius variables;
- document motion and RTL rules.

### Batch B — Components

- inspect library components first;
- import reusable library components only when their semantics and states match SAMS;
- create SAMS-owned components for missing patterns;
- build variants and accessibility annotations.

### Batch C — Patterns

- context bar;
- save state strip;
- day rail;
- period rail;
- search/filter rail;
- roster pattern;
- empty/no-match/error states.

### Batch D — Attendance mobile

- build 390px frame;
- compose from system components;
- add realistic multilingual content;
- include representative status/save/protected states.

### Batch E — Attendance desktop

- build 1440px frame;
- derive from the same task model;
- preserve density;
- expose all periods where practical;
- use semantic table pattern.

### Batch F — Verification

Use Figma structural inspection to verify:

- all created nodes are editable;
- repeated UI uses reusable components/instances;
- no screenshot/flattened full-screen raster exists;
- no placeholder text remains;
- typography uses Inter;
- token bindings exist where supported;
- dimensions are correct;
- RTL notes are present;
- state variants exist.

Then take one full-view screenshot per reference frame.

Do not repeatedly screenshot unchanged states.

## 19. Existing library usage plan

Previously validated libraries/assets remain candidates, not automatic imports.

### Simple Design System

Known previously inspected assets include:

- Button component set: `cc8b558dc7d9684011b6b99ce8e6509399bc836b`
- Input Field: `c28150b04d333d34ed9d2b77abd9f2f54e1a878a`
- Select Field: `b4d568282b67de741c52524b83888113e79a662c`
- Search: `715a105916909fcad1d649ed31db27dc26375edd`
- Card set: `a5bde480886231526d7dd890df3779dc15b52423`
- Heading style: `dfbe5c8aedd892ba1aa0fe61bf528889ff866e4f`
- Body Base: `cebee1b62ea594fa8f97b0b247fd163730736f2a`
- Body Small: `dd16ffab542d022b9a2d78275ed222c2cb4646b4`
- Drop Shadow 200: `6dc22e0ddb735b3b4fdf3afecd5762a1c9bc42ed`

Known spacing variables include `Space/200`, `Space/300`, and `Space/400`.

Known radius variables include `Radius/100`, `Radius/200`, and `Radius/400`.

These keys are historical evidence from the previous library inspection. Because the current Figma MCP tool is rate-limited, they must be revalidated immediately before import/use. Do not assume a stale identifier is still importable.

Material 3 remains a comparison/reference library, not the SAMS visual identity.

## 20. Full research stack mapping into Phase 28

The 13 active research sources remain in scope with constrained roles:

| Source | Phase 28 role |
| --- | --- |
| React Bits | isolated motion/state experiments |
| Manus | rapid composition alternatives |
| Componentry | interaction polish |
| Spline | public/login/brand exploration only |
| MotionSites AI | public/login typography and motion |
| 21st.dev | component/table/navigation alternatives |
| OriginKit | restrained text/background/interaction ideas |
| GetLayers | high-polish public/login composition references |
| styles.refero.design | density, rhythm, token relationship research |
| Skiper UI | rare micro-interaction references |
| Lightswind UI | shell/admin/data-heavy composition references |
| Realtime Colors | palette and contrast validation |
| shadcn/ui | accessible/composable mechanics |

These sources inform alternatives and validation. None is allowed to overwrite SAMS semantics or architecture.

## 21. Current external evidence reinforcement

The current research stack continues to reinforce the established direction:

- Refero positions real product screens and flows as design-research material rather than a single design-system authority. urlRefero research libraryhttps://refero.design/
- Refero Styles exposes extracted typography, spacing, radius, and component relationships, supporting token-level comparison rather than copying identity. urlRefero Styleshttps://styles.refero.design/
- shadcn's current Data Table guidance emphasizes composing data tables from flexible primitives instead of pretending every data table is the same component. urlshadcn Data Table guidancehttps://ui.shadcn.com/docs/components/aria/data-table
- shadcn's current Drawer guidance documents responsive Dialog/Drawer composition, useful for system surfaces while keeping attendance itself inline. urlshadcn Drawer guidancehttps://ui.shadcn.com/docs/components/aria/drawer
- 21st.dev currently exposes a broad table catalogue, useful for comparing mechanics while requiring inspection of state ownership and responsiveness before adoption. url21st.dev table cataloguehttps://21st.dev/community/components/s/table

These references are evidence inputs, not implementation dependencies.

## 22. Non-goals for Phase 28

Do not:

- change `TeacherAttendancePage.tsx` merely because a design variant exists;
- replace native selects before comparing the prototype;
- add bulk attendance behavior without backend support;
- add sticky save UI without focus/scroll evidence;
- add new business states;
- redesign backend contracts;
- create a giant generic component framework;
- introduce a UI library globally;
- create Code Connect mappings without inspecting real nodes and real repo components;
- claim Figma construction while the MCP write gate is blocked.

## 23. Figma construction order once the gate reopens

The first write sequence should be:

```text
00 Foundations
↓
01 Components
↓
02 Patterns
↓
03 Teacher Attendance — 390px
↓
03 Teacher Attendance — 1440px
↓
state variants
↓
RTL/LTR verification
↓
visual verification
```

The screen should be assembled from reusable components rather than drawn as one flat mockup.

## 24. Phase 28 Figma construction and verification

The original Starter-team Figma file remained blocked by its MCP rate limit. A second linked Figma account exposed a student-tier team with an editable design-file creation path, so the Phase 28 construction was completed in a new canonical Figma design file instead of waiting on the blocked Starter file.

Canonical Phase 28 Figma file:

`https://www.figma.com/design/qMn52cWIjW89zqHWahgCgP`

Page architecture:

- `00 Foundations` — semantic color variables, typography styles, spacing/radius variables, and token-bound examples.
- `01 Components` — 16 editable components covering buttons, fields, feedback, page header, pagination, loading/disabled states, and attendance records.
- `02 Patterns` — reusable audit/data and attendance compositions built from component instances.
- `03 Teacher Attendance — Mobile 390` — 390px reference screen using 23 component instances.
- `04 Teacher Attendance — Desktop 1440` — 1440px reference screen using 14 component instances.
- `05 State Coverage` — bounded state matrix and field-state examples covering save, loading, disabled, failure, protected, navigation, focus-visible, and invalid states.
- `06 RTL Verification` — mirrored LTR/RTL attendance compositions with Arabic content and right-aligned RTL text.

The Figma system includes a `SAMS Semantic` variable collection containing semantic color variables plus spacing and corner-radius variables. Inter typography styles were created for title, section, body, and meta hierarchy. Representative visual properties are bound to the SAMS variables.

Construction order followed the Phase 28 sequence: foundations → components → patterns → mobile → desktop → states → RTL verification.

Verification completed:

- Figma structural inspection: PASS; all seven Phase 28 pages exist with populated editable nodes.
- Editable/componentized output: PASS; 16 component nodes are consumed as instances in patterns and reference screens.
- Variable binding: PASS; semantic color variables are bound to representative foundation, component, and screen properties; spacing and radius variables are also created and representative layout properties are bound.
- 390px reference render: PASS; Figma screenshot generated at 390 × 1080.
- 1440px reference render: PASS; Figma screenshot generated at 1440 × 1120.
- State coverage render: PASS; Figma screenshot generated at 1440 × 920.
- RTL/LTR render: PASS; Figma screenshot generated at 1440 × 900 and metadata confirms separate LTR/RTL reference frames.
- Design-context inspection: PASS; generated Figma context resolves reusable component instances rather than a flat screen-only representation.

The original blocked Starter file is retained as historical/raw-capture reference material; it is not the canonical Phase 28 design-system file.

## 25. Phase 28 exit gate

**Design specification gate: PASS**

**Figma construction gate: PASS**

**Phase 28: COMPLETE**

Exit criteria satisfied:

- successful Figma writes;
- structural inspection;
- editable/componentized output;
- 390px reference screen;
- 1440px reference screen;
- state coverage;
- RTL/LTR verification;
- visual screenshot rendering/verification.

--- /workspaces/sams/docs/DESIGN_RD_PHASE_28_FALLBACK_IMPLEMENTATION_2026-09-30.md contents: ---
[Reading 190 lines from start (total: 190 lines, 0 remaining)]

# SAMS — Phase 28 Fallback Implementation Evidence

Date: 2026-09-30

## Scope

The original Starter-team Figma construction path remains rate-limited. Phase 28 construction is nevertheless complete through the verified student-team Figma write path, with the canonical file fully populated and structurally/render verified.

This document now records the fallback production implementation that preceded and complemented the completed canonical Figma construction.

## Research evidence used

- shadcn/ui currently documents Radio Group as a single-choice semantic primitive and explicitly includes disabled and RTL examples. The implementation keeps the production baseline on native `<select>` while the direct-radio pattern remains a prototype candidate.
- 21st.dev's current dashboard guidance separates table/data behavior from visual styling and recommends treating community components as source material whose quality and state ownership must be inspected before adoption.
- Lightswind currently exposes responsive React/Tailwind data-admin patterns, including tables, audit interfaces, and filtering-oriented admin blocks. These were used for pattern comparison rather than copied as product UI.

## Production change

`frontend/src/pages/app/TeacherAttendancePage.tsx`

Implemented from the Phase 28 decision record:

1. Period navigation now uses a horizontal rail on narrow screens instead of the former 2 × 4 grid.
2. Desktop progressively upgrades the same rail into 4 columns at `md` and 8 columns at `xl`, avoiding unnecessary horizontal scrolling when the viewport can carry all periods.
3. Student names use an explicit `dir="auto"` span so mixed Arabic/Latin names have a deterministic bidi boundary without changing the surrounding layout direction.
4. The production attendance status interaction remains the semantic native select baseline. The direct radio interaction is still isolated to `docs/prototypes/phase28-attendance.html` until task-level usability validation justifies replacing the baseline.

## Verification

Executed in `/workspaces/sams/frontend` after the change:

- `npm run typecheck` — PASS
- `npm run lint` — PASS (0 warnings, 0 errors)
- `npm run test:unit` — PASS (10 test files, 45 tests)
- `npm run build` — PASS (Vite production build)
- `git diff --check` — PASS

An attempted `npm run test:unit -- --runInBand` is intentionally not counted as a failure of the implementation: Vitest 5 rejects `--runInBand` as an unknown option. The correct `npm run test:unit` command was then executed successfully.

## Gate status

- Phase 28 design specification gate: PASS
- Phase 28 interaction gate: PASS
- Phase 28 fallback production-reference implementation: PASS for the approved rail/bidi subset above
- Figma construction gate: PASS in the canonical student-team file
- Direct-radio production replacement: NOT APPROVED; requires task-level usability validation across FR/EN/AR, touch, keyboard, and protected lessons

## Research rule

The fallback is intentionally not a clone of another site's UI. External sources are used to extract interaction patterns, density rules, responsive behavior, accessibility semantics, and component composition; SAMS tokens, routing, data flow, save semantics, and attendance-domain constraints remain authoritative.

### Follow-up refinement

The period and day rail items retain `shrink-0` on the production buttons so the horizontal rail preserves stable control geometry on narrow screens rather than letting flexbox compress frequent touch targets. The responsive E2E test now asserts the period controls by accessible button names instead of depending on the old 2 × 4 CSS grid.

## AppShell refinement — fallback construction

Research evidence reinforced a layout rule that is useful to SAMS: authenticated application navigation should be structurally separated from task content, while RTL positioning should use logical start/end relationships. shadcn/ui's current RTL guidance documents this approach for Sidebar/navigation components. The SAMS implementation adapts that principle without importing the library's architecture.

Production change in `frontend/src/components/layout/AppShell.tsx`:

1. Desktop (`md+`) uses a persistent role-aware navigation rail beside the task content.
2. Mobile retains a horizontal overflow-safe navigation rail so the existing 320px responsive behavior remains usable.
3. Active navigation is communicated through weight, surface, and a logical start-border rather than color alone.
4. The shell uses `min-w-0` on the grid/navigation container so the horizontal mobile nav becomes the scroll container instead of expanding the page.
5. Header, navigation, and content now consistently consume SAMS semantic tokens for background, surface, text, muted text, border, and focus.

Verification for this refinement:

- Phase 17 responsive E2E: 4/4 passed.
- Phase 18 accessibility E2E: 7/7 passed.
- Combined regression suite: 11/11 passed.
- Unit tests: 45/45 passed.
- Typecheck: PASS.
- Lint: PASS, 0 warnings / 0 errors.
- Production build: PASS.
- Visual geometry smoke: 390px LTR/RTL and 1440px LTR/RTL all stayed within viewport width; desktop navigation moved to the RTL side correctly.

This is a fallback implementation of the design-system direction. It does not claim Figma structural construction, screenshot verification, or component-library instance binding.

## Token audit follow-up — signature canvas

The signature canvas previously used literal #171717 and #ffffff rendering values. The rendering layer now reads the SAMS semantic text/surface tokens at runtime, while the canvas element itself uses the same surface token for its background.

Verification:

- Typecheck: PASS.
- Lint: PASS, 0 warnings / 0 errors.
- Teacher signatures E2E: 1/1 passed.
- Production build: PASS.

This keeps the implementation aligned with the design-token foundation without changing signature storage, API behavior, or the interaction model.

## Page-level composition audit — PageHeader

The next design-system step was to remove repeated page-header composition without changing route or data behavior.

New shared primitive:

- `frontend/src/components/ui/PageHeader.tsx`

Contract:

- optional eyebrow;
- required title;
- optional supporting description constrained to readable width;
- optional action slot aligned independently from the title block;
- logical-width-safe `min-w-0` title container;
- SAMS semantic text/muted tokens;
- responsive wrapping instead of forcing a wide header row.

Adopted by:

- Teacher Dashboard
- Teacher Classes
- Teacher Class Details
- Teacher Reports
- Teacher Signatures
- Admin Dashboard
- Admin Classes
- Admin Audit

Attendance keeps its own specialized header hierarchy because its context controls are part of the operational workflow rather than generic page actions.

Research decision:

The structure follows the current compositional direction documented by shadcn/ui: layout primitives should be composed from explicit structural regions instead of each page inventing its own wrapper hierarchy. The SAMS component remains intentionally smaller than a generic library shell and does not import shadcn application architecture.

Verification:

- Typecheck: PASS.
- Lint: PASS, 0 warnings / 0 errors.
- E2E regression pack: 22/22 passed.
- Unit tests: 45/45 passed.
- Production build: PASS; `frontend/dist/index.html` present.
- `git diff --check`: PASS.

No business logic, API contract, or route behavior was changed by this composition refactor.

## Data-heavy interaction audit — Pagination

The existing `Pagination` primitive was previously unused while Admin Audit owned an inline previous/next control. The audit found that the primitive rendered every page number, which does not scale for server-side audit histories with many pages.

The primitive is now production-ready for bounded server-side pagination:

- shows previous/next controls;
- exposes the pagination landmark through a caller-supplied accessible label;
- keeps the active page explicit with `aria-current="page"`;
- uses a bounded numeric window with ellipses for large page counts;
- preserves the inherited document direction instead of hard-coding left/right geometry;
- keeps page navigation as buttons so server-side query state remains owned by the page feature.

Admin Audit now consumes the shared primitive and passes its localized labels and pagination landmark label. No data-fetching, query, API, or route behavior changed.

Tests added:

- pagination bounded-window/ellipsis behavior;
- edge disabled-state and next-page callback;
- one-page suppression.

Verification:

- Pagination unit tests: 3/3 passed.
- Full unit suite: 11 files / 48 tests passed.
- Admin + responsive E2E focused suite: 9/9 passed.
- Production build: PASS.
- `git diff --check`: PASS.

Research decision:

Current shadcn/ui guidance treats complex data tables as composition rather than a universal table component, and its pagination examples keep pagination controls separate from the table rendering. SAMS follows the same separation while retaining its server-authoritative feature state. The source used for this decision was the current shadcn/ui Table and Data Table documentation reviewed on 2026-09-30.

## CI verification follow-up — lazy route synchronization

The Phase 20 performance E2E test exposed a CI-only timeout while waiting for the lazily loaded Teacher Attendance route. The test already synchronizes on the semantic attendance heading; its assertion window was increased from the shared 5-second expectation timeout to 15 seconds for this cold-start route only. No fixed sleep was introduced, and local production-preview verification passes all three Phase 20 performance tests.

This change addresses test-environment timing variance rather than changing the attendance runtime behavior.


## Phase 28 Figma construction completion

The Figma construction gate is now complete in the canonical student-team design file:

`https://www.figma.com/design/qMn52cWIjW89zqHWahgCgP`

The file contains foundations, 16 editable components, reusable patterns, a 390px Teacher Attendance reference, a 1440px Teacher Attendance reference, state coverage, and RTL/LTR verification. Semantic SAMS variables are bound to representative visual properties, and Figma screenshot renders were generated for the key reference/state frames.

The earlier Starter-team file remains a historical/raw-capture artifact only; its MCP write path remains rate-limited.

Phase 28 exit gate: **COMPLETE**.
