# SAMS — Design R&D Foundation

Date: 2026-09-30
Scope: post-engineering-gate design research for the React frontend
Baseline: `83524f25c4af2a96b649f454e3f2abb44a8c3bff`

## Status

R&D foundation prepared from the implemented frontend.
No runtime application code is changed by this document.

Figma file creation succeeded, but canvas population is currently blocked by the Figma Starter MCP tool-call rate limit. The Figma file is intentionally left blank rather than filled with an unverified approximation.

## Product source

The current frontend uses:

- React + TypeScript + Vite;
- Tailwind CSS;
- Inter as the product typeface;
- a maximum application content width of 72rem / 1152px;
- responsive desktop and mobile attendance layouts;
- server-authoritative attendance state.

The primary reference screen for design work is **Teacher Attendance / Feuille de présence** because it represents the product's central operational workflow.

## Source-derived visual foundation

Current semantic tokens in the implemented frontend:

| Token | Current value |
| --- | --- |
| background | #f5f5f5 |
| surface | #ffffff |
| muted surface | #f5f5f5 |
| text | #171717 |
| muted text | #6b6b6b |
| border | #d4d4d4 |
| action | #171717 |
| action foreground | #ffffff |
| focus | #2563eb |
| danger | #b91c1c |
| danger surface | #fef2f2 |
| success | #166534 |
| success surface | #f0fdf4 |
| warning | #a16207 |
| warning surface | #fefce8 |
| info | #1d4ed8 |
| info surface | #eff6ff |

The visual direction should preserve the existing restrained, neutral, high-clarity character while improving hierarchy, density, and task flow. Decorative styling should not compete with attendance entry.

## Teacher Attendance information architecture

The screen should be treated as an operational workspace, not as a generic dashboard.

### 1. Application shell

Header:

- SAMS identity;
- signed-in teacher name;
- language selector;
- sign-out control.

Secondary navigation:

- horizontal, role-aware teacher navigation;
- attendance remains a primary destination;
- active route must be visually obvious without relying on color alone.

### 2. Page heading

Primary title:

**Feuille de présence**

Supporting description communicates that the teacher records and verifies attendance for the selected week.

Hierarchy requirement:

- title is visually dominant;
- supporting text is quiet;
- controls start immediately after the heading instead of wasting vertical space.

### 3. Class + week context bar

Primary context:

- class selector;
- previous week;
- current week label;
- next week;
- Aujourd'hui / Today.

Design goal:

The teacher must always understand **which class + which week** is being edited before touching a student.

### 4. Save and state feedback

Persistent operational feedback area:

- present / absent / late / excused counts;
- unmarked count;
- save action;
- saving state;
- retry state;
- saved confirmation;
- unsaved changes;
- signed lesson protection;
- re-sign requirement.

Important design rule:

System state must look like system state. It must not resemble promotional banners or decorative alerts.

### 5. Day navigation

Six weekday controls for the current attendance week.

Each control exposes:

- weekday;
- date;
- selected state.

The selected day must remain clear when viewed quickly on a phone.

### 6. Period navigation

Eight daily periods:

1. 08:00–09:00
2. 09:00–10:00
3. 10:00–11:00
4. 11:00–12:00
5. 14:00–15:00
6. 15:00–16:00
7. 16:00–17:00
8. 17:00–18:00

Desktop can expose all eight at once.
Mobile should preserve horizontal/compact scanning without making the tap targets too small.

### 7. Roster controls

Controls:

- student search;
- all students;
- with absences;
- 8 absences or more.

The result count should remain visible so the teacher knows whether a filter reduced the list.

### 8. Attendance roster

Desktop:

- table;
- row number;
- student name;
- attendance status control;
- absence count.

Mobile:

- student cards;
- name + absence count;
- day context;
- status control.

The interaction target is rapid, repetitive entry. A visually complex card treatment would be counterproductive.

## Responsive design direction

### Desktop

Reference working width:

- viewport: 1440px;
- application content max width: 1152px;
- comfortable horizontal margins;
- dense enough to keep the attendance register above the fold when possible.

Desktop priority:

**context → status → day → period → roster**

### Mobile

Reference working width:

- 390px class of viewport.

Mobile priority:

**class/week → save state → day → period → search/filter → one student record**

Avoid:

- wide tables requiring horizontal scrolling for routine attendance entry;
- tiny status controls;
- excessive nested cards;
- navigation that hides the active workflow.

## Accessibility constraints for the design

The current implementation already uses:

- visible focus styles;
- semantic buttons;
- labels and form field associations;
- aria-pressed for selectable day/filter controls;
- role-aware navigation;
- reduced-motion handling.

Design work must preserve those semantics.

Visual state distinctions must not depend on color alone.

Touch targets should remain comfortably tappable on mobile; the current implementation generally uses at least 40px minimum control heights and the redesign must not reduce them.

## Design-system research result

No Code Connect files exist in the repository.

The blank Figma file has no existing SAMS screens to use as a local component source.

The available Simple Design System library was inspected for the actual primitives needed by this screen. Useful resolved assets include:

- Button component set;
- Input Field component set;
- Select Field component set;
- Search component set;
- Table component set;
- Card component set;
- Heading text style;
- Body Base / Body Small styles;
- Drop Shadow styles;
- spacing variables including Space/200, Space/300, Space/400;
- radius variables including Radius/100, Radius/200, Radius/400;
- semantic background and border variable families.

The design implementation should prefer those reusable library assets over hand-drawn equivalents.

## Figma build sequence

When the Figma MCP rate limit permits writes:

1. Create the SAMS design foundation/page naming.
2. Import and validate the required library components.
3. Import semantic color, spacing, radius, typography, and effect tokens.
4. Build the desktop Teacher Attendance reference view using editable layers and component instances.
5. Build the mobile counterpart as a separate frame.
6. Validate typography, wrapping, spacing, component variants, and interaction hierarchy.
7. Capture one composition screenshot for visual verification.
8. Only after the attendance reference passes, propagate the design language to teacher classes, students, signatures, reports, counselor, and administration screens.

## Non-goals

This R&D phase does not:

- change backend behavior;
- change API contracts;
- introduce a new frontend state library;
- redesign business workflows;
- add offline synchronization;
- replace working accessibility semantics with visual-only patterns;
- treat Figma as the source of truth for authorization or data behavior.

## ECC design gate

Current state:

**R&D READY — Figma canvas population BLOCKED by Starter MCP rate limit**

Engineering and security gates remain closed and verified at the application baseline. This document is the bridge from the verified implementation to the visual design/reconstruction stage.
