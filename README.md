# SAMS — Student Attendance Management System

SAMS is a local-network, multi-user attendance system for schools. The intended deployment is a central Windows computer running Apache/PHP/MySQL through XAMPP, with teachers connecting from phones, tablets, or laptops over the school LAN.

## Stack

- Backend: PHP 8+
- Database: MySQL / MariaDB
- Server: Apache via XAMPP
- Frontend: HTML5, CSS3, Vanilla JavaScript ES modules
- Communication: Fetch API + JSON

## Architecture

```text
Browser
  ↓
public/
  ↓ Fetch API
api/*.php
  ↓
Services / Repositories / Helpers
  ↓
MySQL
```

The database is the source of truth. Browser-side validation is for UX only; authorization, validation, CSRF protection, and data integrity are enforced server-side.

## Directory layout

```text
sams/
├── public/                 # Web-facing pages and assets
├── api/                    # JSON API entry points
├── app/
│   ├── Controllers/        # Request validation/contracts
│   ├── Services/           # Business rules
│   ├── Repositories/       # Database access
│   └── Helpers/            # Security, session, validation, responses
├── config/                 # Local configuration templates
├── database/               # Schema and development seed
├── scripts/                # Local admin/bootstrap utilities
├── storage/                # Runtime-only files
└── tests/                  # Automated tests (final stage)
```

## Development stages

1. GitHub
2. Clone
3. XAMPP
4. MySQL
5. Database
6. Config
7. PHP backend
8. Login
9. Frontend
10. Attendance
11. Signatures
12. Reports
13. Security
14. Playwright
15. Final testing

Stages 14–15 are intentionally left for the final validation phase after the local integration is stable.

## Local setup

1. Put the repository at `C:\xampp\htdocs\sams`.
2. Start Apache and MySQL in XAMPP.
3. Import `database/schema.sql` in phpMyAdmin.
4. Import `database/seed.sql`.
5. Copy `config/database.example.php` to `config/database.php` and configure the local MySQL connection.
6. Run `php scripts/create_admin.php` from the project root and choose a local admin password.
7. Open `http://localhost/sams/`.

Never commit `config/database.php`, real student records, production passwords, or runtime logs.
