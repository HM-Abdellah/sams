# SAMS — Frontend Architecture

Status: Phase 2 architecture baseline, 2026-09-29

## 1. Purpose

This document freezes the frontend architecture for the React reconstruction before page implementation.

The architecture must:

- preserve verified SAMS business behavior;
- adapt to the real API migration boundary;
- keep security/business authority in PHP;
- keep UI concerns replaceable;
- support French, Arabic, and English;
- support LTR/RTL;
- support desktop and mobile task-specific workflows;
- remain compatible with static production hosting through Apache;
- allow the later Design R&D + Figma stage to replace visual language without rewriting domain logic.

## 2. Architectural principles

### Backend authority

The browser never becomes authoritative for:

- authentication;
- authorization;
- school/tenant ownership;
- enrollment truth;
- attendance integrity;
- sign-off protection;
- account lifecycle;
- audit truth.

### Feature ownership

Product capabilities own their:

- UI;
- hooks;
- feature-specific types;
- API adapters;
- interaction state;
- feature tests.

Shared UI components remain presentation primitives and must not contain SAMS business rules.

### State ownership

Use the smallest state scope that reasonably owns the data:

- local component state for ephemeral UI;
- feature state for workflow state;
- URL state for navigational/filter state when it should survive refresh/share/back navigation;
- small session/auth context for identity and CSRF;
- server state fetched through typed feature API adapters;
- no global event bus;
- no Redux store;
- no browser mirror of the database.

## 3. Target repository structure

Initial target:

```
SAMS/
├── frontend/
│   ├── public/
│   │   ├── icons/
│   │   ├── manifest.webmanifest
│   │   └── sw.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx
│   │   │   ├── providers/
│   │   │   └── boundaries/
│   │   ├── routes/
│   │   │   ├── router.tsx
│   │   │   ├── guards/
│   │   │   └── route-config.ts
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   ├── onboarding/
│   │   │   ├── teacher/
│   │   │   └── admin/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── attendance/
│   │   │   ├── students/
│   │   │   ├── classes/
│   │   │   ├── teachers/
│   │   │   ├── onboarding/
│   │   │   ├── imports/
│   │   │   ├── archive/
│   │   │   ├── reports/
│   │   │   ├── signatures/
│   │   │   └── administration/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── layout/
│   │   │   └── attendance/
│   │   ├── services/
│   │   │   └── api/
│   │   │       ├── client.ts
│   │   │       ├── errors.ts
│   │   │       ├── types.ts
│   │   │       ├── canonical/
│   │   │       └── legacy/
│   │   ├── hooks/
│   │   ├── types/
│   │   ├── lib/
│   │   ├── utils/
│   │   └── styles/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── backend/
├── api/
├── database/
├── tests/
└── docs/
```

The exact leaf-file count is intentionally not frozen. The boundaries are frozen; implementation details may evolve when evidence requires it.

## 4. Layer boundaries

```
Page
  ↓
Feature composition
  ↓
Feature hook / action
  ↓
Feature API adapter
  ↓
Typed HTTP client
  ↓
Canonical or legacy endpoint
  ↓
PHP backend
```

### Pages

Pages compose feature capabilities and layout. They should not:

- construct raw fetch calls;
- contain business rules;
- parse arbitrary API payloads;
- duplicate authorization logic.

### Feature hooks/actions

Own user workflows such as:

- loading;
- mutation;
- retry;
- optimistic UI where safe;
- derived feature state;
- cache/refetch decisions;
- error presentation mapping.

### API adapters

Each feature gets a typed API adapter.

Examples:

```
features/attendance/api.ts
features/students/api.ts
features/admin/api.ts
features/onboarding/api.ts
```

These adapters may call either the canonical or legacy transport while the backend migration remains incomplete.

The rest of React must not care which transport is underneath.

## 5. API migration boundary

The current backend has two API surfaces.

### Canonical

Use canonical v1 whenever the verified endpoint exists:

- auth;
- canonical attendance;
- admin dashboard;
- admin classes;
- admin teachers;
- admin teacher-classes;
- admin users;
- admin academic years;
- onboarding;
- school import;
- canonical archive;
- canonical reports;
- canonical signatures.

### Legacy compatibility

Continue using legacy endpoints where the canonical equivalent is not yet mounted/verified:

- operational class compatibility where needed;
- student CRUD/transfer;
- CSV import;
- attendance sign-offs while not yet migrated;
- legacy archive detail routes while required;
- legacy audit compatibility;
- other remaining operational endpoints.

### Rule

No feature imports `fetch` directly.

No component imports a legacy endpoint path directly.

All transport selection is centralized in the API adapter layer.

This allows backend endpoint migration later without a React architecture rewrite.

## 5.1 Typed HTTP client contract

The React foundation centralizes network transport in `services/api/client.ts`.

The client owns:

- same-origin credentials via `credentials: include`;
- JSON request and response handling;
- the shared `{ success, data }` / `{ success, error }` envelope;
- CSRF header injection for protected mutations;
- capture of the CSRF token returned by canonical auth responses;
- conversion of HTTP/API failures into `ApiError` with a stable status code classification.

Feature adapters are responsible only for endpoint paths and typed payload/response shapes. Pages and components must not know HTTP details.

The current onboarding public POST endpoints are an explicit backend contract exception and therefore opt out of CSRF in their adapter rather than silently applying an invented client-side rule.
Request tokens are sensitive transient values: generated navigation keeps them in React Router history state instead of adding them to the URL; direct query-token entry remains available for manual recovery.

The client also rejects non-JSON and malformed API envelopes before feature code receives them. Network-level failures remain distinct from backend HTTP errors so later UX layers can choose retry behavior without guessing.

## 6. Routing model

Use React Router with browser history.

Conceptual routes:

```
/login

/onboarding
/onboarding/status
/onboarding/activate

/app
/app/counselor
/app/attendance
/app/students
/app/signatures
/app/reports

/app/admin
/app/admin/dashboard
/app/admin/classes
/app/admin/teachers
/app/admin/users
/app/admin/onboarding
/app/admin/academic-years
/app/admin/imports
/app/admin/archive
/app/admin/audit
```

These are UI route boundaries, not authorization boundaries.

Route guards exist for UX/navigation only.

Every protected API operation must still be authorized by PHP.

### Route state

Use the URL for state that benefits from:

- back/forward navigation;
- refresh persistence;
- deep links;
- shareable context.

Examples:

- class;
- week;
- month;
- archive view;
- report period;
- search/filter when useful.

Do not put high-frequency ephemeral interaction state into the URL.

## 7. Session architecture

Create a small session/auth context.

It owns:

- authenticated user;
- role;
- school identity returned by server;
- CSRF token;
- auth loading state;
- session invalidation state.

It does not own:

- attendance records;
- students;
- admin datasets;
- arbitrary feature data.

Initial session sequence:

```
App start
↓
GET /api/v1/auth/session
↓
Unauthenticated → /login
Authenticated → application shell
Session invalid → clear client session → /login
```

Login uses the canonical SAMS Code contract.

Logout uses the canonical endpoint.

The client must never persist passwords.

## 8. Error model

Normalize server failures into a typed client error model.

Minimum categories:

- validation;
- authentication;
- authorization;
- not found;
- conflict;
- CSRF/session;
- rate limited where exposed;
- payload too large;
- network;
- invalid response;
- server failure.

UI presentation remains contextual.

Do not expose raw server stack traces.

Do not make translated client messages the source of business truth.

## 9. Attendance architecture

Attendance is a dedicated feature domain.

Structure should support:

```
attendance/
  api
  types
  hooks
  components
  state
  utils
  tests
```

Core state:

- selected class;
- selected week/day/period;
- roster;
- attendance rows;
- sign-off state;
- weekly signature state;
- dirty changes;
- mutation state.

Critical mutation flow:

```
User interaction
↓
Local optimistic/dirty state
↓
Batch boundary
↓
POST canonical attendance bulk endpoint
↓
Server validation + transaction
↓
Authoritative response
↓
Mark saved / restore failed batch
```

The attendance feature must explicitly model:

```
idle
saving
saved
failed
retrying
blocked
```

Signed lessons are rendered as protected state.

Reopen/re-sign behavior comes from verified backend responses.

### Important

Do not mechanically port the legacy `pendingAttendance` map.

Reconstruct the behavior using typed domain state and feature ownership.

## 10. Teacher and admin separation

Use shared primitives but separate workflows.

Teacher:

- attendance-first navigation;
- classes;
- students;
- signatures;
- relevant statistics.

Admin:

- dashboard;
- users;
- teachers;
- assignments;
- onboarding;
- academic years;
- classes;
- imports;
- archive;
- reports;
- audit.

Do not build one giant role-conditional component.

Prefer:

```
Shared primitives
+
Shared domain adapters
+
Role-specific composition
```

## 11. Internationalization architecture

Use a typed internal translation dictionary initially.

Requirements:

- French;
- Arabic;
- English;
- runtime language switching;
- document direction switching;
- locale-aware dates;
- locale-aware numbers;
- translated API error mapping;
- RTL-safe layout primitives.

Translation keys must be semantic, not page-position-based.

Bad:

```
page1_button2
```

Good:

```
attendance.signLesson
students.empty
auth.invalidCredentials
```

The design system must not assume LTR.

Avoid separate Arabic component implementations unless a real structural exception is proven.

## 12. Design-system foundation during engineering

Engineering phases create only the functional foundation:

- semantic tokens structure;
- basic component variants;
- accessibility states;
- spacing primitives;
- responsive primitives;
- status semantics.

Do not lock final visual identity yet.

Final visual decisions belong to the later:

# DESIGN R&D + FIGMA

The engineering architecture must allow the later design system to replace:

- color;
- type scale;
- radius;
- elevation;
- surfaces;
- navigation visuals;
- attendance controls;
- motion language;

without rewriting feature/business logic.

## 13. Shared component rules

Shared components must be:

- typed;
- composable;
- semantic;
- accessible;
- state-aware;
- responsive;
- visually replaceable.

Examples:

- Button;
- Input;
- Select;
- Dialog;
- Drawer;
- Tabs;
- Table;
- Badge;
- Toast;
- Skeleton;
- EmptyState;
- ErrorState;
- ConfirmDialog.

A shared component must not know SAMS business rules unless it is explicitly a domain component under `components/attendance`.

## 14. Security boundaries

Client-side route guards are convenience only.

Never treat these as authorization:

- hidden routes;
- hidden buttons;
- role checks in React;
- URL restrictions;
- local state.

Security-sensitive operations always call the backend.

Sensitive data rules:

- no passwords in state after request completion;
- no secrets in localStorage;
- no unnecessary sensitive data in URLs;
- no sensitive data in console logs;
- no trust in client-supplied school/user IDs beyond server contract.

## 15. Testing architecture

### Unit

Pure utilities and deterministic feature logic.

Examples:

- date/week calculations;
- attendance keying;
- filters;
- status derivation;
- i18n utilities.

### Component/integration

Focus on behavior:

- forms;
- dialogs;
- attendance interactions;
- loading/error states;
- API adapter boundaries.

### E2E

Use Playwright for real journeys:

- authentication;
- onboarding;
- teacher attendance;
- batch save/failure;
- signatures;
- students;
- administration;
- imports;
- reports/archive;
- logout;
- desktop/mobile.

Tests should use deterministic synthetic fixtures only.

## 16. Production architecture

Development:

```
Vite dev server
      ↓
Apache/PHP backend
```

Production:

```
Browser
  ↓
Apache (/sams/)
  ├── frontend/dist → React static build
  └── /api/v1/* → backend/public/index.php
                     ↓
                  PHP backend
                     ↓
                  MySQL/MariaDB
```

No Node.js process is required in production.

The documented Apache deployment builds the frontend with `/sams/` as its Vite base path. React Router derives its basename from the build base, while Apache provides the fallback for client-side routes and keeps API routing separate.

The old PHP-rendered UI is no longer the active production entry point.

## 17. Legacy replacement strategy

The PHP-rendered UI and Vanilla JS frontend have been replaced by the React application at the runtime boundary.

Current state:

```
Legacy UI audit
↓
React replacement
↓
Unit/integration verification
↓
Frontend E2E verification
↓
Static production build verification
↓
React production entry switched
↓
Legacy UI assets removed from runtime
↓
Retired PHP UI entry points return 410 Gone
```

The old /api/*.php endpoints remain a separate backend compatibility surface and are not removed by this frontend phase.

Do not translate legacy file structure one-to-one.

The legacy implementation is a behavioral specification, not an architectural template.

## 18. Architecture acceptance gates

Phase 2 passes only when:

- feature boundaries are explicit;
- page/feature/API responsibilities are explicit;
- canonical vs legacy transport boundary is explicit;
- session architecture is explicit;
- state ownership is explicit;
- routing model is explicit;
- RTL/i18n architecture is explicit;
- attendance architecture is explicit;
- security boundaries are explicit;
- testing boundaries are explicit;
- production hosting model is explicit;
- final visual design remains independently replaceable.

## 19. Phase 2 decision

Status: PASS

The frontend architecture is now frozen at the boundary level.

Phase 3 may implement the React/Vite/TypeScript/Tailwind foundation without inventing page-level business behavior or final visual identity.

Next:

# PHASE 3 — REACT FOUNDATION
