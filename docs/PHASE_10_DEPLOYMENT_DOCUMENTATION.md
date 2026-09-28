# SAMS — Phase 10 Deployment and Documentation

Status: CLOSED

Branch: feat/phase-10-deployment-documentation

## UNDERSTAND

Phase 10 makes the release candidate reproducible outside the developer machine. It documents the supported Apache/PHP/MariaDB deployment, fresh installation, existing-database migration, backup/restore, configuration, verification, and demo-data isolation.

The release scope remains frozen: no new product features and no architecture rewrite.

## PLAN

The deployment target is a central Apache/PHP server with MariaDB/MySQL. The supported local/demo path uses the same PHP application with the built-in development router. Production does not require a Node.js process.

The documented setup must match repository behavior, not an assumed framework or future architecture.

## Supported prerequisites

- Apache 2.4+ with `mod_rewrite` and `mod_headers`.
- PHP 8.3.
- PHP extensions: `pdo_mysql`, `mbstring`, `dom`, `xml`, `xmlwriter`, `zip`, and `gd`.
- MariaDB/MySQL compatible with `database/schema.sql` and the documented migrations.
- Composer 2 for backend dependencies.
- Node.js only for JavaScript/Playwright verification; it is not a production runtime dependency.

## Fresh installation

1. Place the repository in the Apache web root.
2. Ensure Apache allows the repository root `.htaccess` (`AllowOverride All`).
3. Create the database from `database/schema.sql` only when the installation is empty.
4. Copy `backend/config/app.example.php` to `backend/config/app.php` and set `environment=production`, `debug=false`, and the production base path.
5. Copy `backend/config/database.example.php` to `backend/config/database.php` and fill in environment-specific credentials.
6. From `backend/`, run `composer install --no-dev --no-interaction --prefer-dist --no-progress`.
7. Run `composer check-platform-reqs --no-dev` and stop if any required PHP extension is missing.
8. Create the first administrator with `php scripts/create_admin.php` and enter a unique password interactively.
9. Open `/sams/public/` through Apache.

Never run the fresh `schema.sql` rebuild against an existing production database.

## Existing installation

1. Create and verify a database backup before changes.
2. Review `database/MIGRATIONS.md` and confirm the database is at the supported release baseline.
3. Apply only the migration(s) documented for that baseline; for this release, that is `005_school_import_staging.sql`.
4. Run the isolated regression/integration verification.
5. Perform a read-only smoke test before returning the system to teacher use.

## Configuration and secrets

`backend/config/database.php` is the preferred local/deployment configuration file. The compatibility path `config/database.php` remains supported during the backend migration.

Database credentials, `.env` files, runtime logs, uploads, backups, and real school records must stay outside Git.

## Backup and restore

Use `mysqldump` or the equivalent MariaDB dump tool with structure and data. Keep at least one backup independent of the application machine and never test a restore by overwriting the only production copy.

After a restore, verify tables, the active academic year, recent attendance, user accounts, teacher-class assignments, and a login/attendance/report smoke journey.

## Verification

Use an isolated test database. The release verification commands are documented in `docs/DEPLOYMENT_AND_BACKUP.md` and are mirrored by CI.

Required checks include PHP/service tests, MariaDB integration tests, JavaScript syntax, the Playwright suite, and the clean-school acceptance scenario.

Do not run destructive integration or E2E setup against production data.

## Demo / presentation data

Use `scripts/seed_demo.php` only on a clean local/demo database. Its accounts and labeled demo students are not production credentials or production records.

The clean-school acceptance uses synthetic data and `scripts/create_admin.php`; it must never use the real school workbook.

## TEST / RED

Phase 10 documentation was audited against the repository's actual config resolution, Apache rules, PHP dependency requirements, scripts, migration guide, and CI commands.

The Codespace runtime is not the release authority when required PHP extensions are missing locally. CI provides the reproducible PHP/MariaDB environment for final acceptance.

## VERIFY

Release-tree CI validation Run #720 (`36451293759`) passed on exact commit `7648929ab3e0a410a890a970670326658e2566d9`.

- JavaScript syntax job: PASS.
- PHP regression/unit/integration/API smoke job: PASS.
- Clean-school acceptance and persisted-state verification: PASS.
- Existing Playwright E2E suite: PASS.

Codespace validation also passed `git diff --check`, Phase 9 Playwright syntax validation, and PHP syntax lint across the repository. The Codespace PHP runtime was missing `pdo_mysql`, `gd`, and `zip`, so CI remains the authoritative full-environment verification for this gate.

## Gate

CLOSED — deployment and documentation changes passed CI on the exact final commit; the deployment guide now documents prerequisites, configuration, fresh-install versus migration paths, backup/restore, isolated verification, and demo-data separation.
