# SAMS — Student Attendance Management System

SAMS is a school attendance system built around the real weekly attendance-register workflow: teachers record attendance quickly on phones or desktops, while administration manages classes, students, teachers, records, reports, signatures, imports, and audit history.

## Target architecture

- Backend: PHP 8.3
- Database: MySQL / MariaDB
- Web server: Apache-compatible hosting
- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS
- API: REST / JSON
- Tests: PHPUnit + MariaDB integration + Playwright
- PWA: installable app shell; attendance remains online in the first release

Runtime target:

```
Browser
   ↓
Apache
   ├── React static build
   └── /api/v1/* → backend/public/index.php
                         ↓
                     MySQL / MariaDB
```

Production does not require a Node.js process, so the application remains suitable for ordinary PHP/MySQL hosting.

## Engineering workflow

SAMS follows a plan-first, evidence-driven workflow inspired by ECC:

```
UNDERSTAND
   ↓
PLAN
   ↓
TEST / RED
   ↓
IMPLEMENT
   ↓
GREEN
   ↓
REFACTOR
   ↓
REVIEW
   ↓
VERIFY
```

See:
- AGENTS.md — repository engineering rules
- docs/ARCHITECTURE.md — target architecture
- docs/PHASE_1_ARCHITECTURE_PLAN.md — Phase 1 plan
- docs/PHASE_2_BACKEND_FOUNDATION.md — Phase 2 implementation record
- docs/API_CONTRACT.md — current API contract during migration
- docs/DEPLOYMENT_AND_BACKUP.md — deployment, migrations, backup/restore, and release verification
- docs/PHASE_9_CLEAN_SCHOOL_ACCEPTANCE.md — clean-school acceptance evidence
- docs/PHASE_10_DEPLOYMENT_DOCUMENTATION.md — reproducible deployment and documentation gate

## Product rules

### Teacher

The primary workflow is the weekly attendance register:
- 8 daily periods
- Morning and Afternoon grouping
- present / absent / late / excused
- full weekly register on desktop
- optimized Morning -> swipe -> Afternoon mobile view
- signed lessons protected from silent edits
- explicit corrections with audit logging

### Administration

Administration gets a desktop-first control center for:
- attendance overview
- students
- classes
- teachers and assignments
- imports
- archive/history
- reports
- signatures
- audit activity
- academic-year configuration

The dashboard must use real system data and must not invent unsupported integrations or fake metrics.

### Teacher accounts

Teachers do not self-register:

```
Admin creates account
      ↓
Pending activation
      ↓
One-time activation
      ↓
Teacher sets SAMS password
      ↓
Active
```

SMS is optional delivery infrastructure, not a core dependency.

## Backend foundation status

Phase 2 introduces the canonical PHP backend boundary:

```
/api/v1/*
      ↓
backend/public/index.php
      ↓
Request → Router → Controller → Response
      ↓
backend/src/*
```

The existing /api/*.php surface remains a compatibility layer while the endpoint-by-endpoint migration is verified. Do not delete it yet.

## Current repository state

The release candidate contains enrollment-aware attendance, signatures, imports, CI, and the React frontend reconstruction.

The backend source is under backend/src while the old /api/*.php surface remains operational through the compatibility bridge.

The former PHP-rendered UI and Vanilla JS assets are retired from the active runtime. The production boundary serves the React build under `/sams/`, routes `/api/v1/*` to the PHP front controller, and returns `410 Gone` for the retired PHP UI entry points.

## Engineering principles

- Server is the source of truth.
- Browser validation is UX only.
- Controllers stay thin.
- Services own business rules.
- Repositories own SQL/PDO access.
- Persistent mutations are authenticated, authorized, validated, transactional where required, and audited.
- No secrets or real school data in Git.
- Prefer the smallest architecture that solves the actual school workflow.

## Stack constraints

Avoid adding:
- Redux
- Next.js
- GraphQL
- WebSockets
- microservices
- Kubernetes
- Docker Swarm
- large UI/framework bundles

Any future exception must be documented as an explicit architecture decision with a concrete technical reason.
