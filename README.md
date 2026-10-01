# SAMS

## Student Attendance Management System

SAMS is a school attendance platform built around the real weekly attendance-register workflow.

It provides separate workspaces for:

- **Administrators** — school setup, users, classes, imports, reports, archive, audit.
- **Teachers** — weekly attendance, student rosters, class views, signatures.
- **Counselors** — read-only class and attendance access.

The frontend is a React + TypeScript application. The backend is PHP 8.3 with MariaDB/MySQL. Production runs behind Apache; Node.js is only used to build and verify the frontend.

---

## Quick start

This is the practical path for a local/demo installation.

### Requirements

- PHP **8.3**
- Composer **2**
- MariaDB or MySQL
- Node.js + npm
- Apache 2.4+ for the intended production deployment

### 1. Configure the application

From the repository root:

```bash
cp backend/config/app.example.php backend/config/app.php
cp backend/config/database.example.php backend/config/database.php
```

Edit `backend/config/database.php` and set the database connection values.

Do not commit either local configuration file.

### 2. Create the database

For a fresh local/demo database:

```bash
mysql -u root < database/schema.sql
mysql -u root sams < database/seed.sql
```

Use your local MySQL/MariaDB credentials when required.

### 3. Install backend dependencies

```bash
cd backend
composer install --no-interaction --prefer-dist --no-progress
composer check-platform-reqs --no-dev
cd ..
```

### 4. Install and build the frontend

```bash
cd frontend
npm ci --no-audit --no-fund
npm run build -- --base /sams/
cd ..
```

### 5. Create demo data

Only run this against a clean development/demo database:

```bash
php scripts/seed_demo.php
```

The seed creates a clearly labeled demo school, academic year, classes, teacher assignment, students, and demo accounts.

### 6. Start SAMS

From the repository root:
```bash
php -S 0.0.0.0:8080 scripts/dev_router.php
```

Open:

```text
http://localhost:8080/sams/
```

The PHP built-in server is for development/demo use. The production deployment uses Apache.

---

## Demo accounts

The demo credentials are intentionally non-production credentials.

### Administrator

```text
Username: admin.demo
Password: SAMS-Demo-Admin-2026!
```

### Teacher

```text
Username: teacher.demo
Password: SAMS-Demo-Teacher-2026!
```

Use these accounts only with the demo database.

---

## Recommended demo flow

A complete presentation can follow the same workflow a school would use:

```text
Administrator
    ↓
School / academic year setup
    ↓
Classes and users
    ↓
Teacher assignment / onboarding
    ↓
Teacher login
    ↓
Weekly attendance register
    ↓
Attendance status + corrections
    ↓
Signature / sign-off
    ↓
Reports / archive
    ↓
Counselor read-only view
```

For a live demonstration, keep the database synthetic and isolated from any real school records.

---

## Windows / XAMPP deployment

The intended production topology is a Windows machine running Apache/PHP and MariaDB/MySQL, with teachers connecting through the school LAN.

### Fresh installation

1. Place the repository under the Apache web root, for example:

```text
C:\xampp\htdocs\sams
```

2. Enable Apache `mod_rewrite` and `mod_headers`.

3. Allow `.htaccess` overrides for the SAMS directory (`AllowOverride All`).

4. Start Apache and MySQL/MariaDB.
5. For a fresh database, import:

```text
database/schema.sql
```

Do not rebuild an existing production database from `schema.sql`; use the documented migration path instead.

6. Create local application configuration:

```text
backend/config/app.php
backend/config/database.php
```

Start from the corresponding `*.example.php` files.

7. Install backend dependencies:

```bat
cd C:\xampp\htdocs\sams\backend
composer install --no-dev --no-interaction --prefer-dist --no-progress
composer check-platform-reqs --no-dev
```

8. Build the frontend:

```bat
cd C:\xampp\htdocs\sams\frontend
npm ci --no-audit --no-fund
npm run build -- --base /sams/
```

9. Create the first administrator:

```bat
cd C:\xampp\htdocs\sams
C:\xampp\php\php.exe scripts\create_admin.php
```

10. Open:

```text
http://server-name-or-ip/sams/
```

### Important

- Keep database credentials out of Git.
- Keep backups outside the repository.
- Never run demo seed scripts against production data.
- Use the migration documentation for existing installations.

---

## What SAMS does
### Teacher workspace

- Weekly attendance register with 8 daily periods.
- Morning / Afternoon workflow.
- Attendance states: **present, absent, late, excused**.
- Responsive desktop, tablet, and mobile interaction.
- Student roster and class views.
- Teacher-class and subject-aware access.
- Attendance corrections, sign-off protection, and audit history.

### Administration workspace

- Attendance overview and operational dashboard.
- Class and academic-year management.
- Teacher accounts and teaching assignments.
- User lifecycle and password recovery controls.
- Whole-school roster import and reconciliation.
- Archive and historical attendance.
- Reports and signatures.
- Audit activity.

### Teacher onboarding

```text
School onboarding code
        ↓
Teacher request        ↓
Admin review
        ↓
Approval
        ↓
One-time activation
        ↓
Initial SAMS Code
        ↓
Teacher login
```

A request does not grant operational access by itself.

### Counselor workspace

Counselors receive a dedicated read-only workspace based on server-authorized class access. Administrative controls remain outside the counselor route boundary.

---

## Architecture

```text
Browser
  │
  ├── React pages
  ├── feature API adapters
  └── typed HTTP client          │
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
```

The server remains the source of truth for authentication, authorization, tenant scope, validation, attendance integrity, enrollment state, and audit truth.

Production does **not** need a Node.js application server. Node.js is used to build the static frontend bundle and run JavaScript/Playwright verification.

---

## Security model

| Boundary | Release behavior |
| --- | --- |
| Authentication | Server-managed PHP sessions with strict lifecycle controls |
| Session security | Session rotation, idle timeout, absolute timeout, session version invalidation |
| RBAC | admin, teacher, and counselor enforced server-side |
| Tenant isolation | Authenticated school scope enforced across school-owned resources |
| CSRF | Per-session token for protected mutations |
| Passwords | `password_hash()` / `password_verify()` |
| SAMS Codes | Random role-prefixed codes stored as SHA-256 hashes |
| SQL | PDO prepared statements with emulated prepares disabled |
| Imports | Size / row / worksheet limits, staged validation, reconciliation, atomic commit |
| Audit | Security-sensitive and operational mutations are recorded |
| Browser surface | No frontend localStorage / sessionStorage credential persistence |

Frontend guards improve the user experience, but authorization remains a backend responsibility.

---

## Verification

Run verification against an isolated test database.

### Frontend

From the repository root:

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run test:unit
npm --prefix frontend run build -- --base /sams/
```

### Backend

```bash
cd backend
vendor/bin/phpunit --configuration phpunit.xml
cd ..
```

### Full browser suite

```bash
npm ci --no-audit --no-fund
npm run test:e2e
```

The CI pipeline also covers PHP/MariaDB integration, migrations, tenant isolation, security/reliability checks, backup/restore regression, clean-school acceptance, Apache integration, frontend build, and Playwright E2E.

---

## Repository map

```text
sams/
├── backend/                 # Canonical PHP application
├── database/                # Schema, migrations, seed data
├── frontend/                # React + TypeScript application
├── scripts/                 # Development / demo / acceptance utilities
├── tests/                   # Integration and verification suites
├── docs/                    # Architecture, API, deployment, and project docs
├── api/                     # Legacy API compatibility surface
├── app/                     # Legacy bootstrap compatibility bridge
└── .github/workflows/       # CI / release verification
```

---

## Important project documents

| Document | Purpose |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture baseline |
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md) | Frontend / backend API contract |
| [docs/AUTH_IDENTITY_TENANT_CONTRACT.md](docs/AUTH_IDENTITY_TENANT_CONTRACT.md) | Authentication, identity, and tenant rules |
| [docs/DEPLOYMENT_AND_BACKUP.md](docs/DEPLOYMENT_AND_BACKUP.md) | Deployment, backup, restore, and release verification |
| [docs/FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md) | React frontend architecture |
| [database/MIGRATIONS.md](database/MIGRATIONS.md) | Supported database migration path |
| [docs/ACCEPTANCE_CHECKLIST.md](docs/ACCEPTANCE_CHECKLIST.md) | Release / acceptance checklist |

---

## Data and deployment rules

- Never point E2E or demo seed scripts at a real school database.
- Keep production backups outside Git.
- Use `database/schema.sql` only for a fresh installation.
- Use the documented migration path for an existing installation.
- Do not commit `backend/config/app.php` or `backend/config/database.php`.
- Do not commit real school data, credentials, or secrets.

---

## Current release scope

The current release includes the production frontend, backend integration, responsive/accessibility work, administration, teacher, and counselor workflows, reporting, archive, signatures, imports, onboarding, security hardening, and design-system refinement.

PWA / offline attendance synchronization is **not** part of the current release scope.

---

<div align="center">

**SAMS — school attendance, engineered around the real workflow.**

</div>