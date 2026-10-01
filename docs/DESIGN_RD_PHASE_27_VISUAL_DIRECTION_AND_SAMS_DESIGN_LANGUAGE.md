# SAMS — Design R&D Phase 27
## Visual Direction Exploration + SAMS Design Language Definition

Date: 2026-09-30
Status: PASS — visual direction gate
Scope: visual language, tokens, component behavior, motion boundaries, responsive identity; no runtime changes

## Objective

Define a recognizable SAMS visual language before constructing the Figma design system.

The language must:
- support the real attendance workflow;
- remain calm during long teacher sessions;
- work at approximately 390px and 1440px;
- support French, English, and Arabic;
- remain safe in LTR and RTL;
- scale from teacher workflows to administration;
- preserve accessibility semantics;
- avoid copying another product's visual identity.

## Research synthesis

The Design Research Stack was deliberately kept intact. Each source contributes a different capability.

| Source | Contribution to SAMS | What we take | What we do not take |
| --- | --- | --- | --- |
| Refero | real-product screens and flows | product-level hierarchy, density, navigation observations | another product's branding |
| styles.refero.design | machine-readable design-system extraction | inspectable tokens, type/spacing/radius reasoning, precision references | another brand's exact palette |
| shadcn/ui | accessible composable primitives | semantic tokens, tables, forms, drawers, buttons, reusable composition | wholesale replacement of SAMS components |
| 21st.dev | broad component catalogue | variation discovery, table/navigation patterns, code-in-repo mindset | random community aesthetics |
| Lightswind UI | app/admin/data-heavy layouts | shell structure, data organization, responsive application references | ornamental density |
| Componentry | React motion details | small interaction feedback, refined hover/transition ideas | decorative motion in attendance |
| Skiper UI | uncommon interactions | selective micro-interaction references | complex recreation when task cost increases |
| React Bits | motion/visual experimentation | motion vocabulary and isolated prototypes | shaders, cursor effects, or spectacle in core attendance |
| Realtime Colors | palette distribution and contrast testing | role-based color validation | treating its palette examples as SAMS branding |
| Manus | rapid design exploration | fast comparison of visual alternatives | generated UI as architecture |
| GetLayers | high-polish visual and motion exploration | background/motion ideas for public surfaces | cinematic layers behind attendance data |
| OriginKit | animated visual/interactive references | restrained decorative experiments where useful | persistent visual noise |
| MotionSites AI | web motion and public-surface inspiration | typography/motion exploration for public/login pages | landing-page behavior in authenticated workflows |
| Spline | 2D/3D exploration and official MCP | possible brand/login/public visual experiments | 3D in routine teacher attendance |

## External evidence used in this phase

21st currently describes itself as a large registry of React components, templates, and shadcn themes, with code copied into the user's repository and composable with existing design tokens. That reinforces using registries as a source of options rather than as a runtime dependency or brand definition.

shadcn currently exposes primitives including Button, Data Table, Dialog, Drawer, Select, Table, Tabs, Toggle, and related form/navigation pieces. Its current docs also demonstrate responsive Dialog/Drawer patterns and RTL support.

Refero Styles currently exposes machine-readable design systems including real spacing, radius, color, and typography values. The Linear research entry, for example, emphasizes compact density, a 4px base rhythm, controlled radii, and border-led surface separation. SAMS borrows the structural lesson—precision and restrained separation—not Linear's dark palette or lime identity.

Realtime Colors explicitly encourages testing text/background/primary/secondary/accent relationships on realistic page layouts and provides a contrast checker. This supports validating the SAMS palette by role instead of selecting colors in isolation.

Componentry and Skiper both emphasize polished interaction/motion patterns. These are useful for the feel of small states, while the SAMS rule remains that animation must never slow an operational attendance action.

React Bits currently spans animated primitives, backgrounds, UI/cards, application UI, and templates. The useful SAMS contribution is motion vocabulary and isolated experiments, not its more theatrical visual effects.

GetLayers, MotionSites, OriginKit, and Spline are retained for exploration of public/login/brand surfaces and for controlled experiments. Their cinematic/3D capabilities are deliberately separated from the attendance core.

## 1. Visual directions explored

### Direction A — Calm Precision

Characteristics:
- light neutral canvas;
- ink-first typography;
- thin structural borders;
- compact controls;
- small, controlled radii;
- one restrained chromatic utility accent;
- minimal elevation;
- dense information without visual clutter.

Strength:
- aligns naturally with attendance, data tables, administration, and long sessions.

Risk:
- can become visually generic unless typography, spacing, interaction details, and a small SAMS-specific visual signature are handled carefully.

### Direction B — Editorial School Instrument

Characteristics:
- stronger typographic hierarchy;
- slightly more expressive headings;
- more deliberate whitespace;
- subtle paper/editorial cues;
- restrained data annotations.

Strength:
- creates more personality while preserving seriousness.

Risk:
- editorial styling can consume space that attendance needs for the roster.

### Direction C — Soft Modern Education

Characteristics:
- softer surfaces;
- larger radii;
- friendlier cards;
- more visible accent color;
- approachable illustration/motion language.

Strength:
- approachable for onboarding and public-facing surfaces.

Risk:
- easily becomes a generic education SaaS aesthetic; can reduce density and task focus.

## 2. SAMS visual direction decision

SAMS adopts **Direction A — Calm Precision** as the core language, with selected editorial details from Direction B and controlled warmth from Direction C only where they improve comprehension or public/login identity.

This is a product decision, not a copy of Linear, shadcn, or any other system.

The resulting identity is:

# CALM PRECISION — THE DIGITAL SCHOOL REGISTER

Core adjectives:
- calm;
- exact;
- trustworthy;
- efficient;
- contemporary;
- human;
- restrained.

The visual system should feel closer to a carefully engineered professional instrument than to a school-themed marketing site.

## 3. Brand signature

SAMS should not depend on a loud logo, illustration, or gradient for recognizability.

The signature comes from the combination of:
- ink-first typography;
- strong horizontal rhythm;
- compact operational controls;
- precise selected states;
- restrained cobalt utility accent;
- border-led surfaces;
- subtle status geometry;
- unusually clear context hierarchy.

The goal is that a screenshot can be recognized as SAMS because of its composition and interaction language, not because of a decorative hero.

## 4. Core color language

Starting point from the verified frontend semantic tokens:

| Semantic role | Base value | Use |
| --- | --- | --- |
| background | #f5f5f5 | application canvas |
| surface | #ffffff | cards, inputs, tables, dialogs |
| text | #171717 | primary content |
| muted text | #6b6b6b | secondary content |
| border | #d4d4d4 | structural separation |
| action | #171717 | primary action |
| action foreground | #ffffff | primary action text |
| focus | #2563eb | keyboard focus |
| danger | #b91c1c | destructive/error status |
| danger surface | #fef2f2 | error background |
| success | #166534 | successful state |
| success surface | #f0fdf4 | success background |
| warning | #a16207 | warning state |
| warning surface | #fefce8 | warning background |
| info | #1d4ed8 | informational state |
| info surface | #eff6ff | informational background |

### Visual accent rule

A restrained cobalt family can become the SAMS utility accent for:
- links;
- focus;
- informational emphasis;
- selected navigation details where appropriate;
- public/login visual identity.

It must not replace the semantic success/danger/warning roles.

Primary operational actions remain ink-first where that improves predictability and reduces decorative competition.

The chosen #1d4ed8 candidate has approximately 6.70:1 contrast against white and approximately 6.15:1 against #f5f5f5, making it a strong candidate for text-like interactive emphasis. Final token usage still requires contrast verification in each component context.

## 5. Color distribution

Realtime Colors' workflow is useful here: establish neutral text/background first, then introduce primary/secondary/accent deliberately.

SAMS target distribution:
- majority: neutral surfaces and text;
- small amount: cobalt utility accent;
- semantic colors: reserved for state communication;
- decorative color: rare.

No page should require six competing accent colors.

## 6. Typography language

Primary family remains **Inter** because it is already the implemented product typeface and provides a strong neutral UI voice.

Recommended semantic scale for the design system:

| Token | Size | Weight | Typical role |
| --- | ---: | ---: | --- |
| display | 32–40px | 600 | rare public/marketing emphasis |
| page-title | 24–28px | 600 | authenticated page titles |
| section-title | 18–20px | 600 | operational groups |
| body | 15–16px | 400 | main reading text |
| body-medium | 15–16px | 500 | emphasis |
| label | 13–14px | 500 | controls |
| caption | 12–13px | 400 | secondary metadata |
| numeric | inherited + tabular-nums | inherited | counts/statistics |

Rules:
- avoid heavy 700+ typography in the operational core;
- use weight and spacing before color to establish hierarchy;
- use tabular numbers for attendance counts and period/count summaries;
- avoid excessive uppercase labels;
- preserve enough line-height for Arabic glyphs;
- validate wrapping in French and Arabic before locking dimensions.

## 7. Spacing language

Use a 4px base rhythm with a small set of repeated values:

**4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48**

Primary operational rhythm:
- 8–12px: closely related controls;
- 16px: component internal spacing;
- 24px: task-group separation;
- 32px+: major page separation.

This keeps the system closer to a precise instrument than to an inflated dashboard.

## 8. Shape language

Recommended radius vocabulary:

- 4px: small chips/tags when needed;
- 6px: buttons and inputs;
- 8px: compact cards and panels;
- 12px: major containers/dialog surfaces;
- pill radius only when the pill shape carries meaning.

Avoid making every element a pill.

The exact values remain tokens and may be tuned in Figma after visual verification.

## 9. Elevation language

SAMS uses **borders before shadows**.

Default:
- flat surfaces;
- one-pixel structural borders;
- very subtle surface contrast.

Use stronger elevation only for:
- modal/dialog;
- mobile drawer;
- popover;
- transient layered UI.

Do not use giant shadows to create artificial hierarchy.

## 10. Component language

Every core component is defined as:

**Structure + Content + Interaction + States + Accessibility + Responsive behavior**

Initial component families:

### Foundation
- Button;
- Input;
- Search;
- Select;
- Checkbox/Toggle where required;
- Text/Heading;
- Icon button;
- Badge/Status;
- Divider;
- Spinner.

### Operational
- Day selector;
- Period selector;
- Attendance status control;
- Save/state strip;
- Student record;
- Roster table;
- Filter rail;
- Result count;
- Empty/no-match state.

### System
- App shell;
- Navigation;
- Dialog;
- Drawer;
- Toast/status feedback;
- Error boundary presentation.

## 11. Attendance status visual language

Status should be obvious even in grayscale.

Every status should combine:
- label;
- selected geometry;
- clear focus state;
- semantic icon where useful;
- optional semantic color;
- disabled/protected treatment.

Target state vocabulary:

**Unmarked → Present → Absent → Late → Excused**

The selected state should use shape/weight/outline in addition to hue.

Signed lessons should look protected rather than simply "greyed out".

## 12. Navigation language

Desktop:
- compact horizontal role-aware application navigation;
- active route visible through structure + text/indicator.

Mobile:
- navigation optimized for role destinations;
- attendance workflow stays foreground once entered;
- avoid opening an app-wide navigation drawer simply to move between day/period.

The attendance workspace itself is not a generic dashboard.

## 13. Responsive identity

The product should feel like one system at every breakpoint.

### 390px class of viewport
- compact app shell;
- context first;
- horizontal day rail;
- horizontal period rail;
- full-width search;
- filter rail;
- compact student records;
- directly reachable status control.

### Tablet
- same task model;
- more density;
- more side-by-side controls when useful.

### 1440px reference
- 1152px maximum content width;
- dense register table;
- all eight periods visible;
- class/week and operational state share horizontal space;
- search/filter toolbar;
- more simultaneous context visible.

Responsive transformation is structural, not just a smaller font size.

## 14. Motion language

Motion is divided into three levels.

### Level 0 — no motion
For:
- large data changes;
- safety/protection notices;
- table rendering;
- accessibility-sensitive transitions.

### Level 1 — feedback motion
Default for authenticated workflows:
- 100–180ms state transitions;
- subtle opacity/transform;
- immediate pressed feedback;
- quiet success/error confirmation.

### Level 2 — exploratory motion
Allowed mainly for:
- login/public surfaces;
- empty states;
- onboarding;
- brand moments.

This is where React Bits, Componentry, Skiper, OriginKit, GetLayers, MotionSites, and Spline can influence prototypes.

Reduced-motion preference always wins.

## 15. Inspiration boundaries by source

### React Bits
Use isolated interaction references such as subtle reveal or state feedback. Avoid shader/cursor-heavy effects in attendance.

### Componentry
Borrow the quality bar for hover/focus transitions and small interaction choreography.

### Skiper
Use rare, non-critical micro-interactions when they improve comprehension.

### Lightswind
Study shell/data/admin composition and responsive application structures.

### 21st
Compare multiple table/navigation/command implementations, then adapt only the underlying pattern.

### shadcn/ui
Use composable primitives and semantic token conventions as the strongest foundation.

### Refero
Study real product hierarchy and flows before inventing new chrome.

### styles.refero.design
Mine concrete relationships among density, spacing, radius, typography, and surface separation.

### Realtime Colors
Validate palette distribution and contrast on realistic screens.

### Manus
Rapidly explore alternatives before committing.

### GetLayers
Explore high-polish background/motion directions, mainly on public/login surfaces.

### OriginKit
Prototype subtle text/background/interactions where they improve the brand or empty-state experience.

### MotionSites AI
Study cinematic typography/motion techniques for public surfaces, not the teacher register.

### Spline
Reserve 3D for brand/login/public experiments. Its official MCP requires the desktop app on macOS/Windows, so it remains an external research tool rather than the Codespace MCP.

## 16. What SAMS deliberately rejects

Not because these techniques are inherently bad, but because they fail the current SAMS task when used without a concrete benefit:

- neon-first UI;
- giant gradients;
- persistent glassmorphism;
- oversized KPI cards;
- dashboard-template bento grids;
- animated cursors;
- WebGL backgrounds behind attendance;
- excessive rounded cards;
- status conveyed by color alone;
- five different visual accents;
- dense icon-only toolbars;
- long animated transitions;
- ornamental progress rings;
- decorative charts on the attendance entry screen.

## 17. Public/login exception

The authenticated application and the public/login surface can share the same typography, token vocabulary, and geometry while allowing more visual expression outside the core register.

Allowed on public/login:
- subtle atmospheric background;
- restrained motion;
- small 2D/3D visual signature;
- stronger brand composition;
- more expressive hero treatment.

Still avoid:
- performance-heavy decoration;
- inaccessible contrast;
- motion that prevents task completion.

## 18. Design-system principles

1. **Ink before ornament.**
2. **Hierarchy before decoration.**
3. **Structure before polish.**
4. **One task, one visual focus.**
5. **State must be explicit.**
6. **Density is a feature when scanning data.**
7. **Mobile is designed, not compressed.**
8. **RTL is structural.**
9. **Motion explains change.**
10. **Every external pattern must justify itself in SAMS.**

## 19. Figma system blueprint

When the Figma MCP write limit permits, create:

### Pages
- 00 — Foundations
- 01 — Components
- 02 — Patterns
- 03 — Teacher Attendance
- 04 — Teacher Classes
- 05 — Students
- 06 — Signatures
- 07 — Reports
- 08 — Counselor
- 09 — Administration
- 10 — Exploration

### Foundations
- semantic colors;
- typography;
- spacing;
- radii;
- elevation;
- icon rules;
- motion tokens;
- RTL/LTR notes.

### Components
Each component gets:
- variants;
- states;
- content rules;
- responsive notes;
- accessibility notes.

### Patterns
- context bar;
- state strip;
- day/period navigation;
- roster/filter pattern;
- empty/no-match/error pattern.

### First reference
Teacher Attendance:
- mobile 390px;
- desktop 1440px.

## 20. Figma/MCP gate status

Figma get_libraries was successfully queried for the SAMS file. The file currently has community libraries available in the document, including Simple Design System and Material 3 Design Kit, among others.

A follow-up Figma design-system search/write attempt was blocked by the Figma Starter MCP tool-call rate limit. Therefore:
- no fake Figma screen is claimed;
- no unverified components are imported;
- the canvas is not populated by approximation.

Codespace Codex MCP configuration is present for:
- Refero;
- 21st.dev;
- OriginKit;
- GetLayers;
- MotionSites;
- shadcn;
- Lightswind.

The remote MCP entries are registered but several still require account login/authorization or credentials. This is a tooling constraint, not a SAMS runtime dependency.

## 21. Phase 27 decisions

The design language is now:

**Calm Precision — The Digital School Register**

Visual formula:

**neutral canvas
+ ink-first hierarchy
+ restrained cobalt utility accent
+ border-led surfaces
+ controlled radii
+ compact 4px rhythm
+ Inter typography
+ explicit status geometry
+ quiet motion
+ mobile-first attendance**

The language is intentionally composable. It should survive expansion from teacher attendance to administration without becoming a collection of unrelated page styles.

## 22. Verification criteria for next phase

Before visual implementation:
- validate the color system in realistic screens;
- validate Arabic/RTL wrapping;
- validate mobile density at 390px;
- validate desktop density at 1440px;
- compare native select vs direct attendance status prototype;
- compare period rail vs current mobile grid;
- verify focus/selected/disabled/protected states;
- verify motion against reduced-motion;
- validate Figma component variants once MCP writes are available.

## Phase 27 exit criteria

- Multiple visual directions explored.
- One SAMS-specific direction defined.
- All Design Research Stack sources retained and assigned roles.
- Color language defined.
- Typography language defined.
- Spacing/radius/elevation language defined.
- Component language defined.
- Motion boundaries defined.
- Public/login visual exception defined.
- Figma system blueprint defined.
- MCP/Figma constraints documented honestly.
- No runtime/business logic changed.

**PHASE 27 — PASS**

Next:
**PHASE 28 — Figma Design System + Teacher Attendance Reference Screens**
