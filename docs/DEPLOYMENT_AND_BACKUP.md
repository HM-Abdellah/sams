# SAMS — Deployment and Backup Guide

## Production topology

The intended school deployment is a central Windows machine running Apache/PHP and MariaDB/MySQL. Teachers access SAMS from phones, tablets, or laptops over the school LAN.

Keep the database and the web application on the same trusted server unless there is a deliberate infrastructure plan for a separate database host.

## Apache / XAMPP deployment

1. Place the repository under the Apache web root, for example:
   C:\xampp\htdocs\sams
2. Start Apache and MySQL/MariaDB.
3. Create the SAMS database by importing database/schema.sql.
4. Import database/seed.sql only for development/demo environments.
5. Copy config/database.example.php to config/database.php.
6. Set the database host, port, database name, username, and password.
7. Create the first administrator with:
   C:\xampp\php\php.exe scripts\create_admin.php
8. Open the public application entry point:
   http://server-name-or-ip/sams/public/

Do not place database credentials in Git.

## PHP built-in server for development

From the repository root:

    php -S 0.0.0.0:8080 scripts/dev_router.php

Then open:

    http://localhost:8080/public/

This is for development/testing. The router exposes only public/ and api/ and keeps application source/configuration outside the HTTP surface. It is not a replacement for the intended Apache deployment.

## Configuration

The application expects:

    config/database.php

The file is intentionally local-only. Start from:

    config/database.example.php

The database name is validated before being used to build the PDO DSN.

## Migrations

For a release deployment:

1. Back up the current database.
2. Review the migration notes in database/MIGRATIONS.md.
3. Apply the required migrations in order.
4. Run the integration test suite against the target schema where possible.
5. Verify the application with a read-only smoke test before opening teacher access.

Do not skip migration order or manually edit schema objects unless a documented migration requires it.

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

Run:

    php tests/run.php
    php tests/integration.php
    npm install
    npm run test:e2e

The CI pipeline also runs these checks against a clean MariaDB school dataset.

## Demo / presentation data

Keep presentation data separate from real school records. The E2E bootstrap script is intended for ephemeral test databases only and must not be pointed at a real school database.
