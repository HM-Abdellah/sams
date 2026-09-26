# SAMS Architecture — Target Design

Status: Phase 1 architecture baseline, 2026-09-26.

This is the target architecture for the SAMS rebuild. It replaces the current Vanilla JS presentation layer while preserving validated school-domain behavior and data semantics where they remain correct.

## 1. Final folder structure

```
SAMS/
├── frontend/
│   ├── public/
│   │   ├── icons/
│   │   ├── manifest.webmanifest
│   │   └── sw.js
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── layout/
│   │   │   └── attendance/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── attendance/
│   │   │   ├── students/
│   │   │   ├── classes/
│   │   │   ├── teachers/
│   │   │   ├── imports/
│   │   │   ├── reports/
│   │   │   ├── signatures/
│   │   │   └── admin/
│   │   ├── pages/
│   │   ├── services/
│   │   │   └── api/
│   │   ├── hooks/
│   │   ├── types/
│   │   ├── utils/
│   │   └── styles/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/
│   ├── public/
│   │   └── index.php
│   ├── src/
│   │   ├── Controllers/
│   │   ├── Services/
│   │   ├── Repositories/
│   │   ├── Middleware/
│   │   ├── Auth/
│   │   ├── Validation/
│   │   ├── DTO/
│   │   └── Support/
│   ├── config/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   ├── scripts/
│   ├── storage/
│   ├── tests/
│   │   ├── Unit/
│   │   ├── Integration/
│   │   └── Feature/
│   └── composer.json
│
├── e2e/
│   ├── auth/
│   ├── attendance/
│   ├── admin/
│   └── fixtures/
├── docs/
├── .github/
├── AGENTS.md
├── README.md
└── docker-compose.yml
```

Docker Compose is development/CI convenience only. School deployment must not depend on Docker.

## 2. Backend boundaries

**HTTP/public:** `backend/public/index.php` is the API front controller.

**Middleware:** session/authentication, role/resource authorization, CSRF, request limits, common security headers. No attendance business rules.

**Controllers:** translate HTTP input/output and call services. No SQL.

**Services:** business rules and transaction orchestration for authentication, attendance, students/enrollments, assignments, imports, reports, archive, signatures, and audit-triggering workflows.

**Repositories:** PDO queries and persistence only.

**Validation/DTO/Support:** normalization, explicit API shapes, and low-level shared infrastructure.

## 3. API routing strategy

Use a single same-origin REST/JSON surface under `/api/v1/`.

Examples:

```
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/session

GET  /api/v1/classes
GET  /api/v1/classes/{id}
GET  /api/v1/classes/{id}/students
GET  /api/v1/classes/{id}/attendance?week_start=YYYY-MM-DD
POST /api/v1/classes/{id}/attendance/bulk

GET  /api/v1/teachers
POST /api/v1/teachers
GET  /api/v1/users

GET  /api/v1/imports/{id}
POST /api/v1/imports
POST /api/v1/imports/{id}/validate
POST /api/v1/imports/{id}/commit

GET  /api/v1/archive/...
GET  /api/v1/reports/...
GET  /api/v1/audit
```

The exact resource list is frozen against the existing API contract during implementation. Centralized routing prevents duplicated auth, error, header, and observability logic.

## 4. Authentication architecture

### Teacher account lifecycle

```
ADMIN
  ↓
Create teacher
  ↓
employee_id + phone
  ↓
PENDING_ACTIVATION
  ↓
One-time activation credential
  ↓
Teacher sets SAMS password
  ↓
ACTIVE
```

There is no open teacher registration.

Teachers sign in with Employee ID + SAMS password. The shared login screen can accept the appropriate administrative identifier for admin accounts.

Activation credentials are cryptographically random, one-time, hashed at rest, and short-lived. SMS is only a delivery mechanism; the first release must work without an SMS provider.

Password/session rules remain server-side: password_hash/password_verify, secure cookie sessions, session regeneration, idle + absolute expiry, session-version invalidation, account-status checks, login throttling/lockout, and CSRF for state-changing same-origin requests.

Google/OIDC is optional future work and never replaces the school-controlled account lifecycle.

## 5. Database migration strategy

The desired schema becomes the new baseline, but existing installations migrate forward.

Rules:

1. Back up real data before migration.
2. Use ordered forward-only migrations.
3. Record applied migrations in `schema_migrations`.
4. Separate schema changes from data backfills where practical.
5. Verify FKs, uniqueness, enrollment ranges, and attendance references after migrations.
6. Never use the fresh-install schema as a live-data upgrade.
7. Destructive changes require an explicit migration and verification step.

`student_enrollments` remains authoritative for historical attendance.

## 6. React frontend architecture

React + TypeScript + Vite, with React Router and Tailwind CSS.

State rules:
- local component/feature state for ephemeral UI
- small auth/session context
- URL state for navigation/filter state
- typed API client for server communication
- no Redux store
- no global event bus
- no frontend mirror of the business-rule database

Feature folders own feature UI, hooks, types, and API adapters. Shared components are presentation primitives only.

Arabic/French/English translations start with a small internal dictionary and direction handling. Add a translation framework only if actual requirements justify it.

## 7. Attendance data flow

### Read

```
Teacher opens class/week
  ↓
GET /api/v1/classes/{id}/attendance
  ↓
session + role + class authorization
  ↓
enrollment-aware repository query
  ↓
weekly register state
```

### Edit

```
Teacher taps cell
  ↓
local state changes
  ↓
cell becomes dirty
  ↓
dirty changes are batched
  ↓
POST /attendance/bulk
  ↓
server revalidates every entry
  ↓
transaction + audit + signoff invalidation
  ↓
authoritative response
  ↓
client marks changes saved
```

A failed batch restores the prior client state for that batch and shows an error. Signed lessons remain read-only until explicitly reopened.

Desktop renders the full weekly register. Mobile renders the same data as Morning -> horizontal swipe -> Afternoon.

## 8. PWA architecture

Required:
- static web manifest
- 192px and 512px icons
- service worker
- app-shell/static asset caching
- install UI where supported
- update handling for new builds

The first release is not offline-first. Attendance writes remain online. No offline queue or conflict-resolution engine.

## 9. Testing architecture

**Backend:** Composer + PHPUnit. Unit, integration against real MariaDB, and feature tests for authenticated HTTP boundaries.

**Frontend:** Vitest for pure utilities and focused component behavior where useful.

**E2E:** Playwright against deterministic clean-school fixtures. Cover login, RBAC, attendance, bulk save, correction/reopen, students, teachers, imports, reports/archive, signatures, logout, desktop and mobile smoke paths.

Critical behavior needs success, failure, duplicate/conflict, and boundary cases. Target 80%+ coverage for maintained application code; behavioral coverage remains the real quality gate.

## 10. Deployment architecture

### Development

```
Vite dev server
  ↓ /api proxy
PHP built-in server or Apache
  ↓
MySQL/MariaDB
```

### Production

```
Browser
  ↓
Apache
  ├── frontend/dist
  └── /api/* → backend/public/index.php
                     ↓
                  MySQL/MariaDB
```

Production does not require a Node.js process. The system remains compatible with ordinary Apache + PHP 8.3 + MySQL/MariaDB hosting.

## 11. Migration strategy from old frontend

The current Vanilla JS frontend is legacy.

1. Freeze its critical behavior as the reference.
2. Extract real user journeys and API dependencies.
3. Build the React shell without changing backend semantics.
4. Rebuild authentication UX.
5. Rebuild teacher attendance against the stable API contract.
6. Rebuild administration incrementally.
7. Run old-vs-new checks on critical flows.
8. Switch production entry points to the React build.
9. Delete old `public/assets/js` and PHP-rendered UI only after replacement + E2E verification are green.
10. Remove obsolete legacy references from documentation.

Do not translate every old JS function mechanically into React. Preserve behavior and requirements, not legacy structure.

## 12. Definition of Done

Phase 1 is done when all 12 architecture areas are documented, repository rules are committed, migration ordering is explicit, and no working production path was deleted before its replacement was verified.

Complete SAMS is done only after the later implementation phases also prove clean install, secure auth, correct enrollment-aware attendance, real teacher mobile UX, professional administration workflows, imports/archive/reports/signatures, CI, critical E2E, security review, and deployment/backup documentation.
