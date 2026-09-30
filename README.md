# SAMS

## Student Attendance Management System

> A school attendance platform built around the real weekly attendance-register workflow: fast teacher attendance, school administration, controlled teacher onboarding, reporting, imports, signatures, and audit history.

[![SAMS CI](https://github.com/HM-Abdellah/sams/actions/workflows/php-ci.yml/badge.svg?branch=main)](https://github.com/HM-Abdellah/sams/actions/workflows/php-ci.yml)
![PHP 8.3](https://img.shields.io/badge/PHP-8.3-777BB4?logo=php&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111827)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![MariaDB / MySQL](https://img.shields.io/badge/MariaDB%20%2F%20MySQL-supported-003545?logo=mariadb&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?logo=playwright&logoColor=white)

---

## What SAMS does

SAMS is designed for a real school attendance workflow rather than a generic CRUD dashboard.

### 👨‍🏫 Teacher workspace

- Weekly attendance register with 8 daily periods.
- Morning / Afternoon workflow.
- Attendance states: **present, absent, late, excused**.
- Responsive desktop, tablet, and mobile interaction.
- Student roster and class views.
- Teacher-class and subject-aware access.
- Attendance corrections, sign-off protection, and audit history.

### 🏫 Administration workspace

- Attendance overview and operational dashboard.
- Class and academic-year management.
- Teacher accounts and teaching assignments.
- User lifecycle and password recovery controls.
- Whole-school roster import and reconciliation.
- Archive and historical attendance.
- Reports and signatures.
- Audit activity.

### 🧑‍🏫 Teacher onboarding

~~~text
School onboarding code
        ↓
Teacher request
        ↓
Admin review
        ↓
Approval
        ↓
One-time activation
        ↓
Initial SAMS Code
        ↓
Teacher login
~~~

A request never grants operational access by itself.

### 🧭 Counselor workspace

Counselors receive a dedicated read-only workspace based on server-authorized class access. Administrative controls remain outside the counselor route boundary.

---

## Architecture

~~~mermaid
flowchart TB
    Browser["Browser<br/>React + TypeScript + Vite"]
    Apache["Apache 2.4+"]
    React["Static React build<br/>/sams/"]
    API["/api/v1/*"]
    PHP["PHP 8.3<br/>backend/public/index.php"]
    Domain["Controllers → Services → Repositories"]
    DB[("MariaDB / MySQL")]

    Browser --> Apache
    Apache --> React
    Browser --> API
    API --> PHP
    PHP --> Domain
    Domain --> DB
~~~

The production runtime does **not** need a Node.js server. Node.js is used to build the frontend and run JavaScript / Playwright verification.

### Repository boundaries

~~~text
Browser
  │
  ├── React pages
  ├── feature API adapters
  └── typed HTTP client
          │
          ▼
      /api/v1/*
          │
          ▼
   PHP Controller layer
          │
          ▼
      Service layer
          │
          ▼
    Repository / PDO
          │
          ▼
   MariaDB / MySQL
~~~

The server remains the source of truth for authentication, authorization, tenant scope, validation, attendance integrity, enrollment state, and audit truth.

---

## Security model

| Boundary | Release behavior |
| --- | --- |
| Authentication | Server-managed PHP sessions with strict session lifecycle controls |
| Session security | Session rotation, idle timeout, absolute timeout, session_version invalidation |
| RBAC | admin, teacher, and counselor enforced server-side |
| Tenant isolation | Authenticated school_id scope enforced across school-owned resources |
| CSRF | Per-session token for protected mutations |
| Passwords | password_hash() / password_verify() |
| SAMS Codes | Random role-prefixed codes; stored as SHA-256 hashes |
| SQL | PDO prepared statements with emulated prepares disabled |
| Imports | File-size / row / worksheet limits, staged validation, reconciliation, atomic commit |
| Audit | Security-sensitive and operational mutations are recorded |
| Browser surface | No frontend localStorage / sessionStorage credential persistence |

Security hardening is intentionally layered: frontend guards improve UX, while the backend remains the authorization authority.

---

## Project status

The frontend reconstruction roadmap covers **Phases 1–24**. The engineering work has reached the final cross-disciplinary engineering/security gate; visual redesign work is intentionally kept separate.

~~~text
Phases 1–24
    │
    ├── Frontend reconstruction
    ├── Production routing
    ├── Apache + PHP + MariaDB integration
    ├── Accessibility / responsive verification
    └── Frontend testing / performance
            │
            ▼
Final engineering + security red-team audit
            │
            ▼
Design R&D + Figma
~~~

PWA / offline attendance synchronization is **not part of the current release scope**.

---

## Quick start

### Requirements

- PHP **8.3**
- Composer **2**
- MariaDB / MySQL
- Node.js with npm
- Apache 2.4+ for production-style deployment

### Backend dependencies

~~~bash
cd backend
composer install --no-interaction --prefer-dist --no-progress
composer check-platform-reqs --no-dev
~~~

### Frontend dependencies

~~~bash
cd frontend
npm ci --no-audit --no-fund
npm run build
~~~

### Development server

From the repository root:

~~~bash
php -S 0.0.0.0:8080 scripts/dev_router.php
~~~

Open:

~~~text
http://localhost:8080/sams/
~~~

The built-in router is for development and verification. Production uses Apache.

### Production frontend build

~~~bash
cd frontend
npm ci --no-audit --no-fund
npm run build -- --base /sams/
~~~

The resulting static bundle is served from the Apache /sams/ mount.

---

## Verification

Run verification against an isolated test database.

### Frontend

~~~bash
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run test:unit
npm --prefix frontend run build -- --base /sams/
~~~

### Backend

~~~bash
cd backend
vendor/bin/phpunit --configuration phpunit.xml
~~~

### Full browser suite

~~~bash
npm ci --no-audit --no-fund
npm run test:e2e
~~~

The GitHub Actions pipeline additionally covers:

- PHP 8.3 + MariaDB integration.
- Database migrations.
- Tenant-isolation verification.
- Security / reliability integration.
- Backup / restore regression.
- Clean-school acceptance.
- Apache routing and production integration.
- Frontend build and Playwright E2E.

---

## Repository map

~~~text
sams/
├── api/                     # Legacy API compatibility surface
├── app/                     # Legacy bootstrap compatibility bridge
├── backend/
│   ├── src/                 # Canonical PHP application
│   ├── tests/               # Backend unit tests
│   └── config/              # Local-only runtime configuration
├── database/                # Schema, migrations, seed data
├── frontend/
│   ├── src/                 # React + TypeScript application
│   └── dist/                # Generated production build
├── scripts/                 # Development / acceptance utilities
├── tests/                   # Integration, migration, and E2E verification
├── docs/                    # Architecture, contracts, phases, deployment
└── .github/workflows/       # CI / release verification
~~~

---

## Documentation

| Document | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Engineering rules and workflow |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture baseline |
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md) | Frontend / backend API contract |
| [docs/AUTH_IDENTITY_TENANT_CONTRACT.md](docs/AUTH_IDENTITY_TENANT_CONTRACT.md) | Auth, identity, and tenant rules |
| [docs/DEPLOYMENT_AND_BACKUP.md](docs/DEPLOYMENT_AND_BACKUP.md) | Deployment, backup, restore, and release verification |
| [docs/FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md) | React frontend architecture |
| [docs/FRONTEND_PHASE_24_FINAL_ENGINEERING_AUDIT.md](docs/FRONTEND_PHASE_24_FINAL_ENGINEERING_AUDIT.md) | Final frontend engineering audit |
| [docs/FRONTEND_ROADMAP_RECONCILIATION_2026-09-29.md](docs/FRONTEND_ROADMAP_RECONCILIATION_2026-09-29.md) | Official frontend phase accounting |
| [database/MIGRATIONS.md](database/MIGRATIONS.md) | Database migration path |

---

## Engineering principles

SAMS follows a plan-first, evidence-driven workflow:

~~~text
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
REVIEW
   ↓
VERIFY
~~~

Core rules:

- Prefer the smallest change that closes the actual issue.
- Keep controllers thin and business rules in services.
- Keep SQL / PDO access inside repositories.
- Treat browser validation as UX, not authorization.
- Keep real school data and secrets out of Git.
- Do not add infrastructure or frameworks without a documented technical reason.

---

## Technology constraints

The current architecture intentionally avoids unnecessary platform complexity.

Not part of the current baseline:

- Redux
- Next.js
- GraphQL
- WebSockets
- Microservices
- Kubernetes
- Docker Swarm
- Large UI framework bundles

Any future exception should be an explicit architecture decision backed by a concrete technical need.

---

## Data and deployment notes

- Never point E2E or demo seed scripts at a real school database.
- Keep backups outside the Git repository.
- Use database/schema.sql only for a fresh installation.
- Use the documented migration path for an existing installation.
- Do not commit backend/config/app.php or database credentials.

See [docs/DEPLOYMENT_AND_BACKUP.md](docs/DEPLOYMENT_AND_BACKUP.md) for the supported deployment procedure.

---

<div align="center">

**SAMS — school attendance, engineered around the real workflow.**

</div>