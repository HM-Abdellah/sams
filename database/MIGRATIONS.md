# SAMS Database Migration Guide

## Fresh installation

For a new school installation, use the current release schema:

1. Import `database/schema.sql` into an empty database.
2. Do not run `database/seed.sql` on production; it is for local/demo environments.
3. Create the first administrator with `scripts/create_admin.php`.

`database/schema.sql` is the complete schema for the release candidate, including the whole-school import staging tables.

## Supported in-place upgrade for this release

The supported existing-installation upgrade path is intentionally narrow and verified:

`SAMS main baseline` → `005_school_import_staging.sql`

The baseline is the `database/schema.sql` from `main` commit `4daaeb492923a7cdfb909b13c72ae39fb63d0e48`.
That baseline already contains the schema changes represented by the historical 001–004 migrations, teacher management, and attendance sign-off/administration-receipt tables.

For a database at that baseline:

1. Take and verify a full backup.
2. Apply `database/migrations/005_school_import_staging.sql`.
3. Run the isolated regression/integration checks.
4. Perform a read-only smoke test before returning the system to teacher use.

Do not apply `database/schema.sql` to an existing database containing real data.
Do not apply historical migrations 001–004 or the other legacy migration files to this baseline.

## Historical migration files

The files below describe schema changes that are already included in the supported `main` baseline:

- `001_student_identity.sql`
- `002_user_session_version.sql`
- `002_teacher_management.sql`
- `003_student_enrollment_history.sql`
- `003_attendance_register_signoffs.sql`
- `004_student_import_staging.sql`

They are retained as historical artifacts. They are not a linear upgrade sequence for the current release.

Running one of these files against the current baseline can fail with duplicate-column, duplicate-index, or duplicate-table errors.

## Pre-baseline installations

This release does not provide a verified automated upgrade path from schemas older than the supported `main` baseline.

Do not guess a migration order and do not rebuild a real database with `database/schema.sql`.

For an older installation, take a verified backup and perform a dedicated migration/reconciliation assessment before enabling the release. Historical attendance and enrollment relationships must be verified explicitly.

## Migration 005 verification

CI executes `tests/migration_005_integration.php` against the supported pre-005 schema and verifies creation and referential integrity of all three whole-school staging tables.

That check is part of the release CI gate.
