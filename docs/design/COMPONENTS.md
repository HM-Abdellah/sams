# SAMS — Component Contract

Status: Canonical reusable-component specification
Principle: build once, reuse consistently, specialize only when the task requires it

## 1. Component model

Every important component is specified through:

~~~text
Structure
+
Content
+
Interaction
+
States
+
Accessibility
+
Responsive behavior
~~~

Do not treat a screenshot as a component specification.

## 2. Shared shell components

### AppShell

Responsibilities:
- authenticated application frame;
- top header;
- identity;
- language control;
- sign-out;
- role-aware navigation;
- responsive navigation;
- main content outlet.

Rules:
- do not recreate AppShell per page;
- teacher/admin differences are configuration and information architecture, not separate visual systems;
- authentication and authorization truth remains server-side.

### PageHeader

Use for authenticated page entry points.

Anatomy:
- optional eyebrow;
- title;
- description;
- optional actions.

The title must be the strongest page-level text.

## 3. Navigation

### Admin navigation

Current sections:
- Overview;
- People;
- Operations.

Large-screen behavior:
- persistent sidebar;
- grouped labels;
- active route has structural emphasis;
- focus state visible;
- no active state based on color alone.

### Teacher navigation

Compact role-specific navigation.

Prioritize:
- attendance;
- classes;
- students;
- statistics;
- reports;
- signature where implemented and authorized.

Do not expose administrative controls through teacher navigation.

## 4. Button

Variants:
- primary;
- secondary;
- destructive;
- other variants only when justified by an existing shared primitive.

States:
- default;
- hover;
- focus;
- active;
- disabled;
- loading.

Rules:
- mutation buttons disable duplicate submission while loading;
- critical actions require clear labels;
- icon-only requires accessible name.

## 5. Input

States:
- default;
- focus;
- invalid;
- disabled;
- read-only where needed.

Rules:
- label association required;
- errors must be programmatically associated where possible;
- do not use placeholder text as the only label.

## 6. Select

Use for finite authorized choices.

Rules:
- label visible;
- current value obvious;
- disabled state clear;
- options match authorized product data;
- no fake options for unimplemented capabilities.

## 7. Search

An input optimized for finding existing product records.

Use cases:
- classes;
- students;
- teacher/user directories;
- reports/archive where supported.

Rules:
- preserve query during loading/errors where safe;
- show result count when useful;
- filters stay close to the dataset they modify;
- do not add unrelated filters merely because another product uses them.

## 8. Badge / Status

Use for semantic operational status and attendance summaries.

Rules:
- status must not depend on color alone;
- the label remains meaningful in grayscale;
- use neutral treatment when a state is not semantic.

For student records, do not introduce Active/Inactive status because it is not the current SAMS student model.

## 9. Table

Use for dense administration information and desktop-friendly data.

Contract:
- semantic caption or accessible naming;
- real table semantics;
- header row;
- consistent cell padding;
- predictable row borders;
- actions in a dedicated action area where appropriate.

Responsive behavior:
- transform or selectively overflow based on task;
- never force routine mobile teacher attendance into an unreadable miniature table.

## 10. Card / Panel

Use for coherent groups of information.

Common SAMS uses:
- dashboard metrics;
- assignment form;
- grouped data;
- import step;
- supporting status panel.

Avoid cards for individual student rows when a table/list is more efficient.

## 11. Dialog

Use for:
- focused confirmation;
- concise edit/create tasks;
- information that must temporarily block the underlying action.

Requirements:
- accessible name;
- focus management;
- close behavior;
- keyboard support;
- clear primary/secondary actions.

Do not put an entire multi-step workflow into an oversized modal when a page or drawer is more appropriate.

## 12. Drawer

Use mainly on mobile when an off-canvas interaction genuinely helps.

Rules:
- preserve focus;
- ensure content is scrollable;
- avoid covering the action needed to recover from an error.

## 13. Feedback

### StatusMessage

For human-readable errors and important status.

Never expose:
- SQL;
- stack traces;
- internal IDs;
- raw backend payloads.

### Toast

Use only for short-lived confirmations that do not require persistent attention.

Critical record-state feedback belongs in-flow, not only in a disappearing toast.

## 14. Loading / Empty / Error

Every data-heavy screen needs an intentional representation for:
- loading;
- empty;
- error;
- retry.

Rules:
- loading should avoid unnecessary layout collapse;
- empty state explains what is missing and what the user can do;
- error explains what happened and what action is available;
- retry must not silently reset unrelated controls.

## 15. Attendance components

### Day selector

Content:
- weekday;
- date.

States:
- default;
- selected;
- unavailable if product rules require it;
- focus.

Selection must remain clear without color alone.

### Period selector

Content:
- period index/time.

States:
- default;
- selected;
- unavailable/protected as required.

Mobile uses a compact horizontally scannable rail.

### Attendance status control

Statuses:
- unmarked;
- present;
- absent;
- late;
- excused.

Requirements:
- direct interaction;
- strong selected state;
- visible focus;
- semantic text/icon support;
- touch-friendly size.

### Student record

Desktop:
- compact table row.

Mobile:
- compact row/card only where it improves the attendance task.

Content priority:
student name → absence count/context → attendance action.

## 16. Save/state strip

Purpose:
- communicate current save state;
- expose save action;
- show counts when useful;
- expose retry;
- communicate protected/signed conditions.

Do not make it a decorative banner.

Sticky behavior is not the default. Test usability and focus safety before introducing fixed overlays.

## 17. Form groups

Use existing FormField patterns where available.

Form groups should:
- have clear labels;
- group only related fields;
- preserve error context;
- work in RTL;
- collapse responsively.

## 18. Admin data compositions

Typical combinations:

~~~text
PageHeader
+
Toolbar/Search
+
Table
+
Empty/Error/Loading
~~~

or:

~~~text
PageHeader
+
Form Card(s)
+
Result Table
~~~

Use current Admin pages as structural references:
- Dashboard;
- Classes;
- Teachers;
- Users;
- Imports;
- Archive;
- Audit.

Do not copy accidental spacing from one page into another. Reuse the component contract.

## 19. Login components

Login uses shared primitives:
- LanguageSelect;
- Input;
- Button;
- StatusMessage.

The visual treatment is more brand-forward than authenticated pages, but the same typography, semantic colors, spacing discipline, control geometry, and focus behavior must remain recognizable.

## 20. Component reuse rules

Reuse a shared component when:
- the interaction is materially the same;
- the states are the same;
- accessibility requirements are the same.

Create a specialized component when:
- the workflow is genuinely different;
- semantic states differ;
- forcing reuse would make code or UX less clear.

Never duplicate a button/input/navigation implementation solely to obtain different spacing.

## 21. Component change rule

When a shared component changes:
1. inspect all consumers;
2. identify intended vs accidental differences;
3. update the component contract;
4. update affected screens;
5. run focused regression;
6. verify Login + Admin + representative Teacher screens.

A shared component change has higher blast radius than a page-local change.
