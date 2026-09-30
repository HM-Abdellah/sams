[Reading 312 lines from start (total: 312 lines, 0 remaining)]

# SAMS — Phase 28 Attendance Interaction Decision Record

Date: 2026-09-30
Status: **IN PROGRESS — interaction gate**
Scope: Teacher Attendance reference system

## 1. Research question

Determine the most appropriate interaction model for the high-frequency attendance
task at approximately 390px, while preserving the existing backend semantics and
the proven React state architecture.

Research inputs:
- SAMS frontend source and current interaction behavior.
- WAI-ARIA Authoring Practices / W3C.
- WCAG 2.2 target-size guidance.
- shadcn/ui current primitives and RTL guidance.
- 21st current React table catalogue and responsive table guidance.
- React Bits current interaction/micro catalogue.
- Componentry current React interaction catalogue.
- Remaining Design R&D stack roles documented in Phase 27.

No external source is treated as SAMS product authority.

## 2. Current SAMS baseline

Teacher Attendance currently provides:
- six school days;
- eight periods;
- class selector;
- week navigation;
- operational status/save feedback;
- search and three attendance filters;
- desktop semantic table;
- mobile student records;
- native select for attendance status;
- signed/protected lesson disabling.

The current implementation is intentionally not replaced during this gate.

Relevant source:
frontend/src/pages/app/TeacherAttendancePage.tsx

Current mobile status interaction:
one native select per student.

Current mobile period interaction:
2 × 4 grid.

Phase 28 hypothesis:
replace the period grid with a horizontal rail and prototype a faster
direct status interaction without committing the runtime change yet.

## 3. Accessibility findings

W3C's current Radio Group pattern defines a single-selection group and an
explicit keyboard model: Tab enters the group, Space selects, and arrow keys
move selection. This is a full composite interaction contract, not merely a
visual style.

W3C also warns that custom ARIA examples require assistive-technology testing
and that native semantics should be preferred where they already solve the task.

WCAG 2.2 Target Size (Minimum) requires pointer targets to be at least
24 × 24 CSS px unless an applicable exception applies. SAMS therefore keeps
the existing comfort target around 40px+, with about 44px preferred for
frequent primary mobile interactions when space permits.

Implication:
a five-option direct group can be visually fast, but it must not become
five decorative pills with weak semantics or an uncontrolled keyboard model.

## 4. Interaction comparison

### A — Native select (current)

Strengths:
- native semantics;
- one compact control per student;
- one focus target per student;
- robust mobile platform behavior;
- little custom state/keyboard code.

Costs:
- opening the picker adds an interaction step;
- current visual affordance is less scannable at a glance;
- status meaning is mostly exposed after opening the control.

### B — Direct single-choice group

Strengths:
- immediate status visibility;
- one-tap selection;
- repeated entry can be faster for touch users;
- selected geometry can make state visible without opening a menu.

Costs:
- five choices consume more student-card space;
- custom styling must preserve radio semantics;
- keyboard behavior becomes more demanding;
- FR/AR labels can increase width materially;
- protected/signed state needs a distinct non-editable treatment.

### Decision

**B remains a prototype candidate, not the production decision.**
The native select stays the semantic baseline until a real prototype proves
that the additional visual density and interaction complexity materially
improve attendance entry.

## 5. Prototype acceptance criteria

For the 390px reference:
- content width is based on a realistic 16px outer gutter;
- no student card requires horizontal scrolling;
- attendance status is reachable with touch and keyboard;
- selected state survives grayscale inspection;
- focus is always visible;
- FR + EN + AR labels fit without clipping;
- mixed Arabic/Latin student names remain readable;
- signed lessons look protected rather than merely faded;
- one student status change gives immediate local feedback;
- save confirmation remains server-authoritative.

Direct-status prototype must additionally:
- use native radio semantics or an equally robust semantic equivalent;
- expose one group name per student;
- provide deterministic keyboard behavior;
- preserve a practical focus order;
- avoid icon-only meaning;
- avoid five unrelated pill-like buttons pretending to be a control.

## 6. Day and period navigation

### Day rail

Use six selectable buttons in a horizontal rail.
Each item exposes:
- weekday;
- short date;
- selected geometry;
- visible focus.

Use button/selection semantics rather than ARIA tabs because changing the day
does not establish a tabbed multi-panel information architecture.

### Period rail

Replace the current 2 × 4 mobile grid as the reference hypothesis with one
horizontal rail.

Each item exposes:
- period number;
- time range;
- selected state;
- focus state.

Desktop may show all eight periods simultaneously when the layout permits.

The rail is a task selector, not page navigation. It should not inherit tab
semantics merely because items look like tabs.

## 7. Save/state strip

Keep save feedback in-flow.

Priority:
1. operational counts/state;
2. Save action;
3. quiet success;
4. failure + retry;
5. unsaved warning.

Behavior:
- local dirty state appears immediately;
- server confirmation appears only after mutation success;
- failures preserve local work;
- retry is explicit;
- routine modal interruption is avoided;
- no persistent sticky bottom action bar at this stage.

The visual treatment should communicate state by text + structure and may use
semantic color as a supporting cue, never as the only cue.

## 8. Responsive composition

390px:
context → save/state → day rail → period rail → search → filters →
result count → compact student records.

Tablet:
preserve the same task model while allowing useful secondary information
to share rows.

1440px:
1152px max content width, dense semantic table, eight-period visibility,
single search/filter toolbar, keyboard-efficient repeated entry.

Responsive transformation is structural. The desktop table is not simply
shrunk into a phone.

## 9. External pattern roles

React Bits:
use micro-interaction vocabulary only. Its current catalogue includes many
animated and 3D effects, but those are not suitable as default attendance UI.

Componentry:
use as a polish reference for small interaction transitions, not spectacle.

21st:
use its current table catalogue to compare dense table mechanics and mobile
strategies. It explicitly distinguishes simple tables from large data-grid
requirements and notes that responsive tables require an intentional strategy.

shadcn/ui:
use primitives and RTL-compatible structural ideas where they match SAMS,
without replacing SAMS-owned components wholesale.

## 10. Remaining R&D boundaries

Refero / Refero Styles:
validate product hierarchy, density, typography, spacing and surface
relationships.

Realtime Colors:
validate the actual palette in realistic screen contexts.

Lightswind:
study application shell and data-heavy responsive composition.

Manus:
generate/compare alternative compositions before committing.

OriginKit:
selectively inspect interactive/empty-state ideas.

GetLayers:
public/login/high-polish references only.

MotionSites AI:
public/login typography and motion references only.

Spline:
public/login/brand exploration; no 3D in routine attendance.

Skiper UI:
rare non-critical micro-interactions only.

Core rule:
**pattern discovery is broad; production adoption is SAMS-specific.**
## 11. Visual prototype review

The first mobile comparison showed a clear density difference:
- Native select keeps each student record compact.
- Direct status makes the current state visible without opening a control.
- The first direct-status layout used three rows for five options and was too tall.

Targeted visual correction:
- changed the direct-status option grid from two columns to three;
- preserved 40px minimum option height;
- retained native radio inputs and label-based visual states.

Post-fix result:
- five status options fit in two rows;
- the student record becomes materially shorter;
- selected status is immediately scannable;
- protected state remains visually distinct;
- no page-level horizontal overflow was detected at 390px.

## 12. RTL smoke result

RTL rendering was exercised at 390px.
Observed:
- layout mirrored without page overflow;
- selected controls remained visually identifiable;
- day/period rails flowed in RTL;
- direct-status labels remained readable;
- the selected Monday/period remained discoverable at the rail edge.

Follow-up refinement:
mixed Arabic/Latin identity strings should use explicit bidi isolation
around row-number/name fragments during the eventual React implementation.
This is a refinement, not a Phase 28 blocker.

## 13. Current gate conclusion

The direct-status pattern is now a **validated visual prototype candidate**.
It is not yet approved for production implementation.

Production baseline remains:
- native select for semantic/interaction safety;
- horizontal day and period rails as the navigation reference;
- in-flow save/state strip.

The next evidence required before replacing the mobile native select is
task-level usability validation with realistic repeated attendance entry,
including keyboard and touch behavior across FR/EN/AR and protected lessons.

## 14. Prototype artifact

Prototype:
docs/prototypes/phase28-attendance.html

The file is a design lab artifact only:
- not imported by the production app;
- not wired to backend data;
- not part of the runtime route tree;
- safe to modify while exploring the interaction model.

Visual review performed with a headless Chromium render at 390px and 1440px,
plus an RTL 390px smoke render.

## 15. Automated prototype verification

Executed against `docs/prototypes/phase28-attendance.html` with Playwright 1.63.0
using Chromium headless.

Results:
- 390px LTR: body width 390px, viewport width 390px, no horizontal overflow.
- 390px RTL: body width 390px, viewport width 390px, no horizontal overflow.
- Direct-status prototype: 2 groups / 10 option nodes across the two sample
  student records; protected record controls were all disabled.
- Native radio keyboard smoke: moving from the first option with ArrowRight
  selected the second option, confirming browser-managed single-choice keyboard
  behavior in the prototype.
- Save interaction smoke: button transitioned from `unsaved` to `saved` and
  displayed `Enregistré`.
- 1440px: no horizontal overflow; semantic table rendered 3 data rows.

This verification covers structural/interaction constraints of the lab artifact.
It does not replace real task-level usability validation or Figma structural/
visual verification.
