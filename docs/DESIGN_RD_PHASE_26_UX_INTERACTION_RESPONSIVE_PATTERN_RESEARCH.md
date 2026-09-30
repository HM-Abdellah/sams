# SAMS — Design R&D Phase 26
## UX Interaction + Responsive Pattern Research

Date: 2026-09-30
Status: PASS — research gate
Scope: UX interaction model, responsive behavior, accessibility interaction patterns; no runtime changes

## Objective

Determine how Teacher Attendance should behave during repeated real-world use, with mobile as the primary reference and desktop optimized for high-density scanning.

This phase separates:
- what the user sees;
- what the user must understand;
- what the user repeatedly taps/changes;
- what the server can confirm;
- what must remain visible during movement through the workflow.

The target is not a responsive dashboard. It is a digital attendance register optimized for repeated marking under time pressure.

## Evidence base

Primary references researched for this phase:

- Canvas Teacher Android guide — mobile teacher navigation and attendance workflow.
- Google Classroom Help — role-aware home/navigation and mobile teacher differences.
- Moodle Attendance documentation — attendance status model, session workflow, and bulk status actions.
- W3C ARIA Authoring Practices — tabs, buttons, keyboard interaction, composite widgets.
- WCAG 2.2 — Target Size Minimum and Focus Not Obscured.
- GOV.UK Design System — tabs and select guidance.
- Apple Human Interface Guidelines — touch target and control spacing heuristics.
- Nielsen Norman Group — touchscreen target sizing and placement.
- Laws of UX — Fitts's Law and interaction-cost principles.

These sources are evidence inputs, not product identity sources.

## 1. Core attendance task model

Observed SAMS workflow:

1. Choose class.
2. Choose week.
3. Choose day.
4. Choose period.
5. Inspect or adjust the student roster.
6. Set a status for students.
7. Save the server-authoritative changes.
8. Review the resulting state.
9. Protect or revisit signed lessons according to existing business rules.

The repeated loop is primarily:

**student → status → next student**

The navigation loop is:

**day → period → roster → status**

Therefore the design should optimize the repeated loop first, while keeping navigation context visible enough to prevent mistakes.

## 2. Mobile interaction hierarchy

The current design foundation already defines:

**class/week → save state → day → period → search/filter → one student record**

Phase 26 strengthens this into a viewport strategy.

Persistent/high-priority:
- class;
- week;
- current day;
- current period;
- save state when it needs action.

Scrollable/task navigation:
- six-day rail;
- eight-period rail.

Local controls:
- search;
- attendance filters;
- individual student status.

Low-priority context:
- supporting description;
- aggregate counts;
- secondary metadata.

The screen should not require the teacher to mentally reconstruct the current class/day/period after scrolling.

## 3. Day rail: use selection, not page navigation

The six school days are a finite selection set inside one attendance workspace.

Recommended:
- horizontal single-row day rail on mobile;
- clear selected state;
- weekday + date visible together;
- selected day remains identifiable after horizontal movement;
- conventional keyboard support on desktop.

Do not treat the day rail as application navigation.

Reason:
The user is changing a working dimension of the current register, not leaving the attendance feature.

A true tab pattern is possible, but WAI-ARIA tabs introduce composite-widget keyboard behavior and should only be used when the semantics genuinely represent a set of panels. The SAMS day rail is better treated as a selection control unless the information architecture later creates separate day panels.

## 4. Period rail: preserve the same model

The eight periods are another finite selection set.

Recommended mobile treatment:
- one horizontal rail rather than a 2-column/4-column block;
- compact but tappable period items;
- show period number + time range;
- selected state remains visually distinct;
- no separate page transition.

Reason:
The current implementation uses a 2-column mobile grid. It is readable, but it consumes vertical space before the roster. A horizontal rail keeps the primary task surface closer to the roster and creates consistent behavior between day and period navigation.

Desktop may show all eight periods simultaneously because the wider viewport supports scanning.

## 5. Two-dimensional navigation without hiding context

Attendance is a two-dimensional selection problem:

**day × period**

Do not force the user into a deep navigation stack such as:

class → week → day page → period page → roster.

That pattern increases context switching.

Preferred model:

**single attendance workspace**
with:
- class/week context;
- day selector;
- period selector;
- one active roster.

Only the active roster changes when day or period changes.
## 6. Student status interaction: current implementation finding

Current SAMS:
- desktop uses a native Select per student;
- mobile also uses a native Select per student.

GOV.UK's current Select guidance says selects should often be a last resort in public-facing services because users can struggle with them, including on smaller devices. This does not prove that the native select is wrong for SAMS, but it is strong enough to justify testing an alternative for the repeated attendance action.

### Prototype hypothesis

Test a dedicated single-choice attendance status control on mobile instead of a per-student native select.

Potential model:
- visually grouped options;
- one active status;
- explicit labels;
- optional short icon support;
- clear remains available as a deliberate action;
- status change occurs directly from the student record.

The control must remain understandable in French, English, and Arabic. Do not depend on one-letter abbreviations as the only label.

### Boundary

This is an interaction hypothesis, not a business-rule change.

The allowed statuses remain:
- clear/unmarked;
- present;
- absent;
- late;
- excused.

The backend remains authoritative.

## 7. One-tap attendance and bulk action

Moodle and current attendance-focused products expose bulk actions such as marking an entire roster Present and then adjusting exceptions.

Research supports a general efficiency principle:

**default toward the common case, then edit exceptions.**

For SAMS this should be explored as a single deliberate bulk action such as Mark all present.

It must not silently overwrite data or become visually dominant.

Before committing the behavior, verify:
- how it interacts with signed lessons;
- how it interacts with dirty drafts;
- how users understand the scope (current day + period only);
- how it affects save counts;
- how it behaves when filtering is active.

Because business logic already exists, the design can expose only capabilities the backend actually supports.

## 8. Filter placement

Current SAMS filters:
- all;
- with absences;
- 8+ absences.

These filters operate on the roster, so they belong directly adjacent to search/roster controls.

Recommended mobile order:

**Search → filters → result count → first student record**

Do not move filters into an unrelated global settings area.

The active filter should be obvious without relying only on color.

## 9. Search behavior

Search is a local roster operation.

Recommended:
- full-width on mobile;
- immediately above the roster;
- persistent while the list is being scanned;
- clear action visible when text is present;
- result count changes with the query;
- empty-search result explains that no students match.

Do not navigate away to a separate search screen for the attendance roster.

## 10. Save interaction model

The current SAMS engineering model already distinguishes:
- dirty;
- saving;
- saved;
- failed;
- retrying;
- blocked/protected.

Design rule:

**local change feedback and server confirmation must look different.**

When the teacher changes a status:
- the student control can respond immediately;
- the register may be visually dirty;
- server confirmation remains a separate state.

When save succeeds:
- confirm completion without stealing focus;
- do not force a modal;
- do not use a large promotional banner.

When save fails:
- keep the user's local work visible;
- expose a retry action;
- explain what action is available.

This supports a trust model appropriate for records that may later be reviewed.

## 11. Sticky save bar decision

A sticky bottom save bar is tempting on mobile, but it introduces an accessibility trade-off.

WCAG 2.2 states that focused controls must not be entirely hidden by author-created content. W3C explicitly identifies sticky headers and footers as potential causes of focus obstruction.

Decision:
- do not make the save state sticky by default;
- first test a compact in-flow save/state strip;
- consider sticky behavior only after mobile usability testing demonstrates a meaningful benefit;
- if a sticky layer is introduced, reserve viewport space and verify focus visibility and scrolling with keyboard and assistive technology.
## 12. Focus and keyboard model

For desktop, keyboard operation should remain predictable.

Use native controls wherever they already provide the required semantics.

For custom composite controls:
- implement the appropriate ARIA pattern only when necessary;
- keep one clear focus location inside a composite;
- distinguish focus from selected state;
- preserve visible focus;
- do not steal focus after a normal status change unless there is a clear workflow reason.

W3C recommends that tabs, grids, radios, and similar composite widgets use established keyboard conventions rather than ad-hoc key handling.

SAMS preference:
**native HTML semantics first; ARIA only where the interaction genuinely needs a composite pattern.**

## 13. Touch target sizing

WCAG 2.2 SC 2.5.8 sets a minimum target size of 24×24 CSS pixels for pointer input, with exceptions and spacing alternatives.

That is a conformance floor, not the SAMS comfort target.

Apple's HIG uses 44×44 points for iOS touch controls, and Nielsen Norman Group recommends roughly 1 cm × 1 cm as a practical touchscreen target baseline.

SAMS design target:
- keep routine mobile controls around the current comfortable 40px+ range or higher;
- prefer approximately 44px for frequently repeated primary interactions when space allows;
- provide clear separation between neighboring statuses;
- never compress five attendance states into tiny tap targets merely to save vertical space.

Current code observation:
- Select has min-h-10;
- day buttons use min-h-10;
- Button small size is min-h-9 (36px);
- period buttons rely on padding/line-height rather than an explicit 40px minimum.

This is not automatically a WCAG failure, but it is below the project's current 40px comfort intent and should be addressed during final visual implementation rather than hidden by visual styling.

## 14. Fitts's Law application

Fitts's Law reinforces the same direction: larger and closer targets are acquired faster and with fewer errors.

SAMS application:
- place status control next to the student name;
- keep common actions in the immediate working area;
- avoid requiring the user to move to a distant toolbar for each student;
- keep adjacent competing status choices visually separated;
- make high-frequency controls larger than low-frequency utility actions.

Do not interpret Fitts's Law as "make everything huge". The target must balance accuracy, information density, and scanability.

## 15. RTL and LTR behavior

SAMS supports French, English, and Arabic.

W3C and Material bidirectionality guidance reinforces:
- layout should adapt to the document direction;
- directional icons such as back/forward should mirror;
- numbers themselves should remain in appropriate numeric direction;
- logical start/end properties are safer than hard-coded left/right positioning.

SAMS consequences:
- day and period rails must support both flow directions;
- previous/next week icons must communicate direction correctly in RTL;
- no component should depend on left/right as a structural assumption;
- mixed Arabic + Latin names/codes need careful bidi handling;
- horizontal scrolling behavior must remain understandable in RTL.

## 16. Responsive breakpoint behavior

Do not define mobile only as "desktop under 768px".

Use task-driven changes.

### Phone
- compact shell;
- horizontal day rail;
- horizontal period rail;
- full-width search;
- filter rail;
- one student record at a time in a compact vertical rhythm;
- avoid horizontal table scrolling for routine attendance.

### Tablet
- preserve the mobile interaction model where it remains efficient;
- allow more roster density;
- optionally expose secondary context side-by-side.

### Desktop
- all eight periods visible;
- class/week and operational state can share one row;
- dense table;
- search + filters in one toolbar;
- keyboard-efficient repeated entry.

The interaction model remains recognizable across breakpoints even when the composition changes.

## 17. Focus visibility under scrolling

Horizontal rails and sticky/overlapping surfaces create a special risk:
a focused day/period/status control can become partially hidden by viewport layers.

The design should therefore:
- use scroll positioning that keeps the focused item visible;
- avoid persistent overlays covering the interaction rails;
- test focus while moving through all day/period controls;
- test zoomed layouts and narrow viewports.

W3C documents scroll-padding as one technique for reducing focus obstruction.

## 18. Motion rules for attendance

Motion should reinforce state, not decorate the register.

Acceptable moments:
- subtle pressed feedback;
- short state transition for a status change;
- calm save confirmation;
- retry progress;
- focus/selection transitions.

Avoid:
- long animations;
- bouncing status pills;
- large slide transitions between days/periods;
- animation on every roster row;
- decorative confetti or attention-grabbing success effects.

All non-essential motion must respect reduced-motion preferences.

## 19. Error/empty/no-match interaction

The roster needs distinct meanings.

### Empty
No students exist in the selected class.

### No matches
Students exist, but search/filter returned zero.

### Load error
The server could not provide the register.

### Save error
The register was loaded, a local mutation occurred, and server persistence failed.

These states should not reuse one generic blank card.

Each state should preserve the teacher's mental model of:
**where am I, what data am I seeing, and what can I do next?**
## 20. Design decision matrix

| Area | Research conclusion | SAMS decision |
| --- | --- | --- |
| Day navigation | finite in-workspace selection | horizontal selectable rail |
| Period navigation | finite in-workspace selection | horizontal selectable rail on phone; all visible on desktop |
| Attendance status | repeated high-frequency action | prototype direct single-choice control |
| Native select | valid but can be difficult on small screens | keep for now; test replacement before visual lock |
| Bulk action | common-case optimization | prototype Mark all present with explicit scope |
| Search | local roster transformation | inline full-width search |
| Filters | roster-local controls | adjacent to search |
| Save state | trust-critical feedback | compact in-flow operational feedback |
| Sticky bottom bar | can obscure focus | avoid by default |
| Mobile records | task-first scanning | compact records, not giant cards |
| Desktop roster | high-density scanning | native semantic table |
| RTL | direction is structural | mirror layout + directional icons |
| Motion | feedback only | short, predictable, reduced-motion aware |

## 21. Prototype hypotheses for Phase 27

Phase 27 should compare real interaction variants, not just color/spacing variants.

### Hypothesis A — Status control
Native select vs direct single-choice control.

Measure:
- taps per student;
- accidental status changes;
- time to mark ten consecutive students;
- clarity of current status.

### Hypothesis B — Period navigation
Mobile 2×4 grid vs horizontal period rail.

Measure:
- vertical space before first student;
- period recognition time;
- accidental period changes;
- ease of moving from period to period.

### Hypothesis C — Save state
In-flow operational strip vs compact sticky save region.

Measure:
- discoverability of unsaved changes;
- visibility after scrolling;
- focus obstruction;
- perceived confidence.

### Hypothesis D — Bulk attendance
No bulk action vs explicit Mark all present.

Measure:
- time to complete a mostly-present class;
- rate of accidental mass changes;
- user understanding of scope.

## 22. Phase 26 exit criteria

- Deep UX interaction research completed.
- Current SAMS interaction model inspected against external evidence.
- Mobile attendance interaction hypotheses defined.
- Desktop/mobile divergence rules documented.
- Touch-target requirements grounded in WCAG and platform heuristics.
- RTL interaction requirements documented.
- Sticky/focus risks identified.
- Native select concern documented without blind replacement.
- Testable prototype hypotheses defined.
- No runtime/business logic changes introduced.

**PHASE 26 — PASS**

Next:
**PHASE 27 — Visual Direction Exploration + Design Language Definition**
