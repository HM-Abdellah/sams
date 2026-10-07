# SAMS — UX Design Brief

Status: Canonical product UX contract
Audience: product, UX, UI, frontend, QA
Applies to: Login, Administration, Teacher, Counselor
Baseline: current SAMS React frontend and verified design R&D decisions

## 1. Product purpose

SAMS is a school attendance management system built around the real attendance-register workflow.

The product must feel like a serious school instrument:

> traditional school register + modern responsive application + trustworthy administration archive

SAMS is not a marketing site, generic SaaS dashboard, social product, or education game.

Core priorities:
1. correctness;
2. data integrity;
3. clarity;
4. speed of routine work;
5. accessibility;
6. consistency;
7. visual refinement.

## 2. Users

### Teacher

Primary environment: phone, then tablet/desktop.

The teacher needs to:
- understand current class, date, and period;
- record attendance quickly;
- correct legitimate mistakes;
- see operational feedback;
- sign off when required;
- access students, reports, statistics, and assigned classes without unnecessary navigation.

Teacher UX is operational and mobile-first.

### Administration

Primary environment: desktop/laptop.

Administration needs structured management of:
- dashboard and attendance overview;
- classes and academic years;
- students;
- teachers and teaching assignments;
- users and onboarding;
- imports;
- archive;
- reports;
- signatures;
- audit activity.

Admin UX is desktop-first, information-dense, searchable, and traceable.

### Counselor

Use the same institutional visual language as administration where backend permissions allow it. Do not invent counselor-only product concepts.

## 3. Shared product principles

### Recognition over recall

Controls and workflows must be predictable. The user should not need to remember hidden rules.

### Context before action

Before a record-changing action, show enough context to identify what is being changed.

For attendance:
class → week/date → period → student.

### Feedback is part of the interface

Important asynchronous actions need clear states:
- idle;
- loading;
- success;
- error;
- retry;
- protected/signed where applicable;
- unsaved changes where applicable.

### Prevent errors before explaining them

Prefer constrained choices, validation, sensible disabled states, and clear confirmations over allowing invalid operations.

### Calm precision

The interface should be quiet enough for long daily use, but never visually vague.

## 4. Shared visual identity

Login and authenticated pages belong to one product.

Shared identity:
- Inter typography;
- neutral light canvas;
- white surfaces;
- dark ink-first primary actions;
- restrained cobalt utility accent;
- semantic status colors;
- border-led surfaces;
- compact controlled radii;
- clear typography hierarchy;
- subtle motion only where it improves feedback.

The authenticated app currently uses:
- sticky top header;
- SAMS identity and signed-in user;
- language control;
- sign-out;
- admin sidebar on large screens;
- responsive navigation on smaller screens;
- constrained content width;
- light neutral background;
- bordered white content surfaces.

New pages must reuse these established patterns instead of inventing a new shell.

## 5. Responsive philosophy

Responsive means task adaptation, not simply shrinking desktop.

### Phone

Optimize the teacher's immediate task:
- compact header;
- reachable navigation;
- context visible;
- controls large enough for touch;
- vertical information hierarchy;
- horizontal rails only where they improve scanning;
- no routine horizontal-table dependency.

### Tablet

Keep the same mental model while allowing more density and selective side-by-side grouping.

### Desktop

Optimize administration and high-density teacher work:
- more information visible at once;
- table layouts where appropriate;
- sidebar navigation for admin;
- stronger horizontal grouping;
- keyboard-friendly operation.

## 6. Language and direction

SAMS supports French, English, and Arabic.

The layout must support true LTR/RTL behavior.

Rules:
- use logical start/end positioning;
- mirror directional controls when meaning requires it;
- do not reverse numeric content unnecessarily;
- test mixed Arabic and Latin names/codes;
- never let Arabic names break container sizing;
- every component must remain usable in both directions.

## 7. Accessibility

Accessibility is a product requirement.

Required:
- semantic HTML first;
- visible keyboard focus;
- associated labels;
- accessible names for icon buttons;
- status not communicated by color alone;
- touch-friendly controls;
- readable error messages;
- reduced-motion support;
- focus must not be obscured by overlays;
- dialogs and drawers must preserve focus behavior.

Do not add ARIA when native semantics already solve the problem.

## 8. Content principles

Use the application's real terminology.

Do not invent capabilities such as external Massar integrations, predictive attendance, medical records, messaging integrations, or fake infrastructure status.

Prefer concise labels:
Teacher → Class → Action

Avoid decorative copy that competes with operational information.

## 9. What consistency means

Consistency does not mean every page has the same layout.

It means the same system is recognizable through:
- same shell rules;
- same typography roles;
- same spacing rhythm;
- same controls;
- same state vocabulary;
- same border/radius/elevation behavior;
- same interaction feedback;
- same responsive logic.

Teacher pages may have a different information hierarchy from Admin pages while remaining unmistakably SAMS.

## 10. Definition of done for a new screen

A screen is design-complete only when:
- its user goal is explicit;
- its flow is represented in userflow.md;
- its visual rules fit DESIGN-SYSTEM.md;
- reusable UI is specified in COMPONENTS.md;
- layout and states are specified in SCREEN-SPECS.md;
- desktop/tablet/mobile behavior is defined;
- loading/error/empty/success states are defined;
- accessibility behavior is defined;
- implementation matches the specification;
- visual regression does not introduce unrelated drift.

## 11. Design authority

Order of authority:
1. real product/backend behavior;
2. this design contract;
3. existing implemented shared primitives;
4. screen-specific specification;
5. external design references.

External products and design libraries are research inputs, never product truth.

Do not redesign working business behavior because a screenshot looks nicer.

## 12. Design change rule

When changing a page:
- inspect current implementation;
- identify shared components affected;
- update the canonical spec if the design decision is intentional;
- implement the smallest safe change;
- verify adjacent pages for regression.

A one-page visual change must not silently create a second visual system.
