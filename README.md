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

sudo service mariadb start
mysql -u root < database/schema.sql
mysql -u root sams < database/seed.sql
php scripts/seed_demo.php

php -S 0.0.0.0:8080 scripts/dev_router.php
```

Open:

```text
http://localhost:8080/public/
```

### Local demo accounts

`scripts/seed_demo.php` creates non-production demo accounts and a small demo school dataset for manual testing.

```text
Administrator
Username: admin.demo
Password: SAMS-Demo-Admin-2026!

Teacher
Username: teacher.demo
Password: SAMS-Demo-Teacher-2026!
```

The teacher is assigned to `DEMO-2BAC-A`, while `DEMO-2BAC-B` is available for administration and transfer tests.

These credentials are for local/demo testing only. Never use them for a real school deployment.

Using the project root as the built-in server document root is intentional because the application keeps public/ and api/ as sibling directories. The router exposes only public/ and api/ to the built-in server, while keeping application source and configuration outside the web surface. The built-in server is for development/testing; Apache remains the intended school-LAN deployment target.

## Weekly attendance workflow

The operational attendance sheet is weekly rather than a large monthly grid. The teacher selects a Monday-to-Saturday week, then a day and period; on phones, each student is presented as a large touch-friendly card so classes of around 36 students do not become a tiny wall of columns.

Attendance records remain in the database permanently. The weekly screen is only the operational view; it does not delete or overwrite previous weeks.

Historical attendance is exposed through the administration archive only. This keeps the teacher workflow focused on current attendance while allowing administrators to review previous periods for school records and end-of-term activity assessment.

Attendance follows the paper-register convention: a present student stays blank, while an absent student gets an **X**. One tap toggles blank ↔ X. After the teacher finishes a lesson, they sign that lesson; signing locks its attendance cells. A correction requires an explicit reopen action, and the correction is audited. The week also has a final certification area where each teacher assigned to the class signs their weekly register. Changing a certified lesson invalidates the weekly signatures so the file cannot silently diverge from what was signed.

The **Print week** action builds an independent A4 landscape, black-and-white attendance register from the same weekly data loaded on screen. The printed version is intentionally denser and more formal than the digital UI, with class information, six school days, eight periods per day, a lesson sign-off matrix, all weekly teacher certifications, and captured signature images.

## Teacher directory and multilingual administration

The administration interface now has a dedicated **Teachers** area. It tracks teacher identity data (employee ID and phone), recent presence, multilingual subjects, and exact teaching assignments to classes. A teaching assignment is tied to one teacher, one subject, and one class, so branches and academic years are not collapsed into one ambiguous label.

For an existing local database, apply the required migrations in order:

```sql
SOURCE database/migrations/002_teacher_management.sql;
SOURCE database/migrations/003_attendance_register_signoffs.sql;
```

Fresh installations receive the same structure automatically through `database/schema.sql`.

The interface supports French, Arabic, and English through one shared translation dictionary. Navigation, attendance, administration, teachers, dialogs, reports, runtime messages, and accessibility labels use the same language state; Arabic also switches the document direction to RTL.

The teacher online indicator is based on a short authenticated heartbeat window rather than a permanent connection. It is intended to mean **recently active** and is not a presence history.

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

Do not use `scripts/seed_demo.php` on a real school database. The demo credentials and dataset are intentionally fixed for local testing only.
