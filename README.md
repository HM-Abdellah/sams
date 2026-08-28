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

## Local setup — XAMPP on Windows

1. Put the repository at `C:\xampp\htdocs\sams`.
2. Start **Apache** and **MySQL** in XAMPP.
3. Open phpMyAdmin and import `database/schema.sql`.
4. Import `database/seed.sql` into the same `sams` database.
5. Copy `config\database.example.php` to `config\database.php`.
6. For a default XAMPP MySQL installation, keep:
   - host: `127.0.0.1`
   - port: `3306`
   - database: `sams`
   - username: `root`
   - password: empty
7. From the project root, create the first administrator:

```bat
C:\xampp\php\php.exe scripts\create_admin.php
```

The script creates the username **`admin`** and asks you to choose the password. There is intentionally **no default admin password in GitHub**.

8. Open:

```text
http://localhost/sams/
```

The root URL redirects to the public web directory automatically.

## Login troubleshooting

### `Invalid credentials.` immediately after importing the database
This normally means no administrator exists yet. Run:

```bat
C:\xampp\php\php.exe scripts\create_admin.php
```

Then log in with:

```text
Username: admin
Password: the password you chose during setup
```

### `Missing config/database.php`
Create the local config from the template:

```bat
copy config\database.example.php config\database.php
```

Then verify the MySQL settings in `config\database.php`.

### `Database connection failed.`
Check that MySQL is running in XAMPP and that the `sams` database exists. Re-import `database/schema.sql` when necessary.

### Apache shows the directory instead of SAMS
Make sure the project is directly under `C:\xampp\htdocs\sams` and that Apache's `mod_rewrite` is enabled. SAMS uses the root `.htaccess` to redirect `/sams/` to `/sams/public/`.

## Security rules

Never commit `config/database.php`, real student records, production passwords, or runtime logs.

Do not add a hard-coded admin password to `seed.sql`: the local administrator is deliberately created separately with a password hash generated on the local machine.
