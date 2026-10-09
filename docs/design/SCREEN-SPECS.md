# SAMS — Screen Specifications

Status: Canonical screen-level design contract
Rule: every page implementation must match this document or update it in the same change

## 1. Global screen anatomy

Authenticated baseline:

~~~text
SAMS AppShell
├── Top header
│   ├── SAMS identity
│   ├── signed-in user
│   ├── language
│   └── sign-out
├── Role-aware navigation
└── Main content
    ├── PageHeader
    ├── Task controls
    ├── Primary content
    └── Supporting states
~~~

Do not create a second shell for a single page.

## 2. Login

Reference implementation: frontend/src/pages/auth/LoginPage.tsx

Desktop:
- two-column composition;
- dark brand panel on the left;
- focused form on the right;
- language selector at form header;
- restrained SAMS brand mark;
- attendance-register preview is supporting brand context only.

Mobile:
- single-column form;
- compact SAMS identity;
- no oversized decorative panel;
- language selector remains accessible.

Required states:
- session loading;
- normal;
- invalid credentials;
- generic/unavailable failure;
- submitting.

Accessibility:
- explicit labels;
- keyboard focus;
- password autocomplete;
- readable error message;
- no color-only validation.

## 3. Admin application shell

Desktop reference:
- sticky top header;
- left navigation around 17rem;
- main content on neutral background;
- white bordered surfaces;
- grouped admin navigation.

Mobile/tablet:
- do not force the desktop sidebar;
- preserve role-aware navigation in a compact form;
- keep page title and primary action reachable.

Global shell identity must be reused by all admin pages.

## 4. Admin Dashboard

Purpose: operational overview, not decorative analytics.

Required groups:
- page title/date;
- refresh/reload action where supported;
- summary metrics;
- attendance/class statistics;
- attention items;
- classes without today's records;
- recent audit activity.

Visual hierarchy:
page context → key numbers → operational lists/tables.

Do not turn metrics into oversized marketing cards.

## 5. Admin Classes

Purpose:
- inspect school classes;
- search/filter with the current product model;
- open class details.

Filters:
- Search;
- academic year;
- study level such as TC / 1BAC / 2BAC.

Do not add:
- Student Active/Inactive;
- Status filter;
- Sort filter

unless the data model explicitly changes.

Results should expose only real class/product fields.

## 6. Admin Students

Purpose:
- inspect whole-school student roster.

Toolbar:
- Search;
- Select Class.

Select Class groups classes by study level as appropriate.

Do not show a student Status column.

Student details preserve school-record context without decorative profile treatment.

## 7. Admin Teachers

Reference page: frontend/src/pages/app/AdminTeachersPage.tsx

Purpose:
- teacher directory;
- teaching assignment;
- subject management where implemented.

Structure:
1. PageHeader.
2. Assignment form surface.
3. Subject create/edit surface.
4. Teaching assignment table.
5. Teacher directory table.
6. Subject table.

Visual rules:
- same card/table language as current Admin pages;
- forms use shared fields;
- primary actions use shared Button;
- assignment/unassignment is clearly distinguishable from navigation;
- destructive/unassign action requires confirmation;
- status badges remain semantic.

Teacher activity/presence information is displayed only when the backend supplies it.

## 8. Admin Users / Onboarding

Use the same admin shell, PageHeader, form, table, feedback and dialog patterns.

Onboarding flow:
~~~text
Request
 ↓
Admin review
 ↓
Approval
 ↓
One-time activation / account setup
 ↓
Operational access
~~~

Do not style pending requests as already authorized users.

## 9. Admin Imports

Use a staged workflow:

~~~text
PageHeader
 ↓
Upload/select surface
 ↓
Processing state
 ↓
Validation/preview surface
 ↓
Corrections if supported
 ↓
Confirmation/result
~~~

The visual state must distinguish:
- uploaded;
- processing;
- validation failed;
- ready to commit;
- committed;
- commit failed.

## 10. Admin Archive / Reports / Signatures

These are record-oriented screens.

Prioritize:
- context;
- search/filter;
- readable records;
- traceability;
- print/readability where supported.

Avoid decorative analytics that make historical records harder to scan.

## 11. Admin Audit

Purpose: readable traceability.

Show:
- user;
- action;
- entity;
- date/time;
- relevant metadata when available.

Raw technical JSON must not be the default presentation.

## 12. Teacher Home

Purpose: quick operational entry point.

Hierarchy:
1. current school/user context;
2. assigned work/classes;
3. today's or current attendance entry point;
4. secondary links to students/statistics/reports/signature.

Do not turn Teacher Home into a copy of Admin Dashboard.

## 13. Teacher Classes

Purpose:
- show assigned classes;
- let the teacher enter the selected class workspace.

Each class item prioritizes:
class identity → useful context → primary action.

Avoid giant decorative cards.

## 14. Teacher Class Workspace

Purpose: class-specific operational entry point.

Hierarchy:
- class identity;
- current context;
- primary attendance action;
- student/report/statistics/signature access where authorized.

Keep the workspace visually related to Admin class details but optimized for teacher task completion.

## 15. Teacher Attendance — PRIMARY REFERENCE SCREEN

Reference: current Teacher Attendance implementation and Design R&D foundation.

Purpose:
digital version of the familiar paper attendance register.

### Desktop

Recommended hierarchy:
class/week → operational state → day → period → roster

Expected structures:
- app shell;
- page title/subtitle;
- class/week controls;
- save/state strip;
- weekday selector;
- period selector;
- roster filters;
- attendance table.

### Mobile

Hierarchy:
class/week → save state → day → period → search/filter → one student record

Expected behavior:
- compact header;
- horizontally scannable day rail;
- horizontally scannable period rail;
- full-width search;
- compact roster rows/cards;
- directly reachable attendance status control.

Routine attendance must not require horizontal scrolling across a wide table.

### Attendance states

Support:
- unmarked;
- present;
- absent;
- late;
- excused.

Communicate state through text/geometry/icon where useful, not hue alone.

### Operational feedback

Expose as relevant:
- saving;
- saved;
- unsaved changes;
- error;
- retry;
- protected/signed;
- re-sign consequence where applicable.

Do not hide critical save state in a temporary toast only.

### Attendance print artifact

The weekly register print view is a paper-first record, not a dashboard.

Required behavior:
- print the complete selected-class roster, regardless of the current screen search/filter;
- preserve the backend's per-period attendance truth for each school day;
- present = `○`;
- absent = `×`;
- late = `L`;
- excused = `E`;
- unmarked = `·`;
- place teacher signature and date lines below the complete register;
- use A4 landscape with compact, grayscale-readable borders and typography.

Print action must flush pending attendance changes before opening the browser print dialog.

## 16. Teacher Students

Purpose:
- inspect students in assigned class context.

Keep the same shell and component language as attendance.

Optimize for:
student → class context → useful record information.

No invented medical or external-system data.

## 17. Teacher Statistics

Purpose:
summarize attendance information that the backend actually provides.

Hierarchy:
- context;
- key measures;
- trends/breakdown;
- detail where it supports a decision.

Do not invent performance numbers.

## 18. Teacher Reports

Purpose:
open/generate reports supported by the product.

Prefer:
- clear scope;
- clear date/class context;
- readable output state;
- print-friendly layout when supported.

## 19. Teacher Signature

Purpose:
sign/inspect protected attendance records according to existing authorization.

Hierarchy:
- selected record/context;
- current signature state;
- primary action;
- protection/confirmation feedback.

Do not claim an external digital-signature authority.

## 20. Loading / empty / error / success

Every page with asynchronous data must specify:
- Loading;
- Empty;
- Error;
- Success after mutation when applicable.

Empty states should answer:
- what is missing;
- why it may be empty;
- what the user can do next.

Errors should answer:
- what happened;
- whether current data is preserved;
- what action is available.

## 21. Mobile/desktop parity

A page is responsive when:
- the same product identity remains;
- the same information remains understandable;
- priority changes are intentional;
- no control becomes too small;
- no important state disappears;
- keyboard/focus and touch interactions remain usable.

Do not call a page responsive merely because its width fits.

## 22. Visual QA checklist

For every changed screen verify at:
- 390px-class phone width;
- tablet width;
- 1440px-class desktop.

Check:
- typography and wrapping;
- spacing;
- border/radius consistency;
- focus;
- RTL/LTR;
- loading/error/empty;
- long names;
- large data;
- action hierarchy;
- navigation active state;
- no accidental unique colors;
- no duplicate components;
- no shell drift from Login/Admin.

## 23. Cross-screen consistency matrix

| Surface | Must share with rest of SAMS |
| --- | --- |
| Login | typography, semantic colors, control geometry, language |
| Admin | shell, PageHeader, controls, tables, cards, feedback |
| Teacher | shell, typography, tokens, controls, state semantics |
| Counselor | admin-style visual language where applicable |

Different task does not mean different design system.

## 24. Page change protocol

Before editing any screen:

~~~text
Inspect current screen
        ↓
Inspect shared components
        ↓
Read this screen spec
        ↓
Read DESIGN-SYSTEM.md
        ↓
Read COMPONENTS.md
        ↓
Identify intended change
        ↓
Implement minimal safe change
        ↓
Verify page
        ↓
Verify shared consumers
~~~

If the desired change cannot fit the current specification, update the specification first or in the same change. Never let implementation become the undocumented source of a new design rule.

