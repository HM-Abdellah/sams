# SAMS — Deployment and Backup Guide

## Production prerequisites

The supported release deployment assumes Apache 2.4+, PHP 8.3, MariaDB/MySQL, Composer 2, and a Node.js build environment used only to produce the static React bundle.

PHP must provide these extensions used by the release candidate and PhpSpreadsheet: `pdo_mysql`, `mbstring`, `dom`, `xml`, `xmlwriter`, `zip`, and `gd`.

Apache must allow the repository root `.htaccess` to run (`AllowOverride All` for the SAMS directory) and must provide `mod_rewrite` and `mod_headers`.

Node.js is not required by the production runtime. It is used only to build the static React bundle and run JavaScript/Playwright release verification.

## Production topology

The intended school deployment is a central Windows machine running Apache/PHP and MariaDB/MySQL. Teachers access SAMS from phones, tablets, or laptops over the school LAN.

Keep the database and the web application on the same trusted server unless there is a deliberate infrastructure plan for a separate database host.

## Apache / XAMPP deployment

1. Place the repository under the Apache web root, for example:
   C:\xampp\htdocs\sams
2. Enable Apache `mod_rewrite` and `mod_headers`, and allow `.htaccess` overrides for the SAMS directory (`AllowOverride All`).
3. Start Apache and MySQL/MariaDB.
4. Create the SAMS database by importing `database/schema.sql` only for a fresh installation with no existing SAMS data.
5. For an existing installation, back up the database and apply the supported in-place migrations in `database/MIGRATIONS.md` in the documented order instead of rebuilding the schema.
6. Import `database/seed.sql` only for development/demo environments.
7. Copy `backend/config/app.example.php` to `backend/config/app.php` and set `environment=production`, `debug=false`, the production base path, and the required session/login settings.
8. Copy `backend/config/database.example.php` to `backend/config/database.php`.
9. Set the database host, port, database name, username, and password in that local file.
10. Install backend dependencies from the repository root with:

       cd backend
       composer install --no-dev --no-interaction --prefer-dist --no-progress
       composer check-platform-reqs --no-dev

11. Build the React frontend:

       cd ..\frontend
       npm ci --no-audit --no-fund
       npm run build -- --base /sams/

12. Create the first administrator with:
   C:\xampp\php\php.exe scripts\create_admin.php
13. Open the application entry point:
   http://server-name-or-ip/sams/

Do not place database credentials in Git.

## PHP built-in server for development

From the repository root:

    php -S 0.0.0.0:8080 scripts/dev_router.php

Then open:

    http://localhost:8080/sams/

This is for development/testing. The router serves the React production bundle and routes /api/v1/* to the PHP backend. It is not a replacement for the intended Apache deployment.

### CS50.dev clean demo setup

For a clean local/demo database in CS50.dev:

    cp backend/config/database.example.php backend/config/database.php
    sudo service mariadb start
    mysql -u root < database/schema.sql
    mysql -u root sams < database/seed.sql
    php scripts/seed_demo.php

Then start the built-in server:

    php -S 0.0.0.0:8080 scripts/dev_router.php

Open the forwarded port and use:

    Administrator
    Username: admin.demo
    Password: SAMS-Demo-Admin-2026!

    Teacher
    Username: teacher.demo
    Password: SAMS-Demo-Teacher-2026!

The demo seed creates the 2026/2027 academic year, two demo classes, a teacher-class assignment, and four demo students. It is intentionally for local/demo testing only.

## Configuration

The application prefers:

    backend/config/database.php

The compatibility path `config/database.php` is also supported while the backend migration remains in progress. For new installations, use the backend path.

The file is intentionally local-only. Start from:

    backend/config/database.example.php

The database name is validated before being used to build the PDO DSN.

## Migrations

For a release deployment:

1. Back up the current database.
2. Review `database/MIGRATIONS.md` and confirm the database is at the supported release baseline.
3. Apply the current release migrations in the documented order: 005, 006, 007, 008, then 009. Do not skip or reorder migrations.
4. Run the integration test suite against the target schema where possible.
5. Verify the application with a read-only smoke test before opening teacher access.

Do not invent, reorder, or manually edit schema changes outside the migration path documented for the target baseline.

## Backup

Use a database-level dump that includes structure and data.

Example on a machine with mysqldump:

    mysqldump -u root -p --single-transaction --routines --triggers sams > sams_backup.sql

Store backups outside the Git repository and protect them according to the school's data-handling rules.

At minimum, keep:

- a recent backup before every schema migration;
- a periodic scheduled backup during the school year;
- one copy that is independent from the application machine.

## Restore

Restore into a controlled database instance:

    mysql -u root -p sams < sams_backup.sql

After restoring:

1. Confirm tables exist.
2. Confirm the active academic year is correct.
3. Confirm recent attendance records exist.
4. Confirm user accounts are present.
5. Run a login/attendance/report smoke test.
6. Recheck teacher-class assignments.

Never test a restore by overwriting the only production copy.

## Release verification

Run the full verification only against an isolated test database, never against production data.

Backend dependencies:

    cd backend
    composer install --no-interaction --prefer-dist --no-progress
    composer check-platform-reqs --no-dev
    cd ..

Service/integration verification:

    php tests/run.php
    php tests/integration.php
    php tests/school_import_final_integration.php
    php tests/xlsx_resource_limits_integration.php
    php tests/attendance_backend_integration.php
    php tests/concurrency_regression.php
    php tests/administration_backend_integration.php
    php tests/phase6_archive_reports_signatures_integration.php
    php tests/phase7_security_reliability_integration.php
    php tests/backup_restore_integration.php

Browser verification:

    npm ci --no-audit --no-fund
    npm run test:e2e

The database-dependent tests expect `SAMS_TEST_DB_HOST`, `SAMS_TEST_DB_PORT`, `SAMS_TEST_DB_NAME`, `SAMS_TEST_DB_USER`, and `SAMS_TEST_DB_PASS` for the isolated test database. CI supplies these values and also runs the clean-school acceptance gate.

## Demo / presentation data

Keep presentation data separate from real school records. The E2E bootstrap script is intended for ephemeral test databases only and must not be pointed at a real school database.

For local/manual demo setup, use:

    php scripts/seed_demo.php

This creates only clearly labeled demo users/classes/students and must never be used against a real school database.
