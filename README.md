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
   └── /api/* → PHP application
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
- `AGENTS.md` — repository engineering rules
- `docs/ARCHITECTURE.md` — target architecture
- `docs/PHASE_1_ARCHITECTURE_PLAN.md` — Phase 1 plan
- `docs/API_CONTRACT.md` — current API contract during migration

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

## Current repository state

The existing release candidate already contains a PHP/service/repository foundation, enrollment-aware attendance, signatures, imports, CI, and a legacy Vanilla JS frontend.

The rebuild preserves validated domain behavior while replacing the presentation architecture and tightening the HTTP boundaries.

Do not delete the legacy runtime until its replacement exists and the relevant critical workflows are verified.

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
