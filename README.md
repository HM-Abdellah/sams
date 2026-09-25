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

The release candidate is executed in ordered layers. See [docs/RELEASE_PLAN.md](docs/RELEASE_PLAN.md) for the gates and acceptance criteria.

1. Baseline / scope freeze
2. Teacher attendance
3. Administration
4. Archive, reports, signatures
5. Security / reliability
6. Playwright E2E
7. Clean-school acceptance
8. Deployment and documentation
9. Final review / release freeze

The layers are delivery and verification gates; they do not require an architectural rewrite.

## Development on CS50.dev / PHP built-in server

SAMS needs both PHP and MySQL/MariaDB. php -S replaces Apache for development only; it does not replace the database.

From the project root:

```bash
cp config/database.example.php config/database.php
# Edit config/database.php with the local MariaDB credentials.

php -S 0.0.0.0:8080 -t .
```

Open:

```text
http://localhost:8080/public/
```

Using the project root as the built-in server document root is intentional because the application keeps public/ and api/ as sibling directories. The built-in server is for development/testing; Apache remains the intended school-LAN deployment target.

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
