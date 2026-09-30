# SAMS — Frontend Phase 13 — Students / Classes

Status: PASS — 2026-09-29

## Objective

Build the teacher-facing Students and Classes workflows on the verified backend contract.

Phase 13 covers:

- operational class list;
- class details;
- academic-year / level / branch context;
- class roster;
- student search;
- student details;
- teacher-authorized student create;
- teacher-authorized student edit;
- enrollment-aware historical-context messaging.

The phase does not invent teacher access to historical archive data. Full historical student history remains an archive capability governed by the backend and belongs to the later archive/report phase.

## Architecture

The workflow follows:

page → feature hook → feature API → shared HTTP client → backend

Server state remains feature-owned:

- useTeacherClasses
- useClassStudents

Navigation state remains in React Router:

- class selection uses class_id query state;
- class detail uses /app/classes/:classId.

The backend remains authoritative for:

- authorization;
- school scope;
- class visibility;
- student validation;
- enrollment creation;
- student identity uniqueness;
- historical placement.
## Implemented

### Classes

Teacher routes now include:

- /app/classes
- /app/classes/:classId

The class list exposes only the operational classes returned by the teacher class API.

Each class can expose:

- class name;
- level;
- branch;
- academic year;
- academic-year date range;
- links to class details, roster, and attendance.

Class details show the same operational context and a bounded roster preview.

### Students

The teacher roster page now supports:

- class selection in URL state;
- local search across name, student number, and Massar code;
- student status;
- student details dialog;
- current class / academic-year context;
- add student;
- edit student;
- mutation loading/error/success feedback;
- authoritative roster refresh after successful mutation.

Inactive students remain visible when returned by the backend, but the teacher edit action is not offered for inactive records because the backend rejects edits to inactive students.

### Historical context

The UI deliberately does not fabricate historical enrollment records from students.class_id.

Student details explicitly identify the displayed class information as current operational context. Historical attendance remains conceptually tied to server-side enrollment records.

Full historical student history is not added to the teacher workflow because the existing archive endpoint is admin-only.
## Backend contract adjustment

A proven Phase 13 gap was identified: the teacher class list contained the academic-year id but not the academic-year display name or date range.

The smallest safe backend change was made in ClassRepository::forUser():

- academic_year_name
- academic_year_starts_on
- academic_year_ends_on

These are additive response fields. Authorization, filtering, tenant boundaries, and class selection semantics are unchanged.

The API contract was updated in the same change.

## Files changed

Frontend:

- features/classes/types.ts
- features/students/api.ts
- features/students/types.ts
- features/students/useClassStudents.ts
- features/students/StudentFormDialog.tsx
- features/students/StudentDetailsDialog.tsx
- pages/app/TeacherStudentsPage.tsx
- pages/app/TeacherClassesPage.tsx
- pages/app/TeacherClassDetailsPage.tsx
- routes/route-config.ts
- routes/router.tsx
- i18n teacher copy in features/i18n/types.ts and dictionary.ts

Backend / contract:

- backend/src/Repositories/ClassRepository.php
- docs/API_CONTRACT.md
## Tests / verification

- TypeScript typecheck: PASS
- Oxlint: PASS — 0 warnings / 0 errors
- Vite production build: PASS
- git diff --check: PASS
- Phase 13 Playwright: PASS — 3/3
- E2E coverage:
  - class list and details;
  - academic-year context;
  - class roster;
  - student search;
  - student details;
  - server-backed student update;
  - server-backed student creation;
  - authoritative roster refresh after mutations;
  - class URL state;
  - Arabic RTL direction.

Playwright command:

SAMS_BASE_URL=http://127.0.0.1:4173/ npx playwright test tests/e2e/frontend_phase13_students_classes.spec.js --project=chromium

Result:

3 passed (4.8s)

No real school/student fixture data was used.

## RED → GREEN

### RED

The existing React frontend lacked:

- a teacher class list route;
- class detail route;
- student create/update adapters;
- student detail view;
- student mutation UI;
- academic-year display fields in the operational teacher class response.

### GREEN

Implemented the missing feature boundaries without moving business authority into React.

Mutation flow is:

form → typed studentsApi mutation → server success → roster reload → UI reflects refreshed server state

A refresh failure is not treated as an authoritative UI confirmation.
## Design Craft review

The phase uses the existing functional component foundation and applies the design-craft lenses without opening final visual design work.

Applied principles:

- task-first information hierarchy;
- clear class context before roster interaction;
- shared controls instead of one-off form primitives;
- keyboard/screen-reader labels through shared FormField/Dialog components;
- responsive wrapping rather than fixed-width controls;
- restrained visual treatment;
- no invented decorative complexity.

Final branding, final visual identity, Figma, and decorative motion exploration remain deferred until after the engineering roadmap.

## Gate

# PASS

Phase 13 requirements are implemented and verified for the teacher operational workflow.

Current project state:

Phase 1–13 = PASS

Next:

Phase 14 — Admin Platform
