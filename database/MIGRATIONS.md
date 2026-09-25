# SAMS Database Migration Guide

## Fresh installation

For a new school installation, use:

1. `database/schema.sql`
2. `database/seed.sql`
3. create the first local administrator with `scripts/create_admin.php`

The fresh schema already contains the final tables for the current release candidate.

## Existing installation

For an existing SAMS database that predates the current schema, apply migrations in numeric order:

1. `001_student_identity.sql`
2. `002_user_session_version.sql`
3. `003_student_enrollment_history.sql`
4. `004_student_import_staging.sql`

Back up the database before applying migrations.

## Migration 003 — enrollment history

Migration 003 changes attendance from depending only on `students.class_id` to an explicit `student_enrollments` record.

The migration seeds an initial enrollment from the student's current class and academic year, then backfills attendance using that current class.

**Important:** this is lossless only when historical class transfers were not already performed before migration 003. When transfers happened earlier, reconcile the historical attendance/class relationship before running the migration.

After migration 003, verify:

- every student has the expected enrollment history;
- every attendance row has a valid `enrollment_id`;
- transferred students keep historical attendance attached to the correct enrollment;
- no attendance row points to an unrelated class.

## Migration 004 — student import staging

Migration 004 adds staging tables for the controlled student-import flow.

The import pipeline is:

`Select file → Parse → Normalize → Validate → Preview → Correct → Revalidate → Import`

Only a completely valid batch can create production student records.

## Release rule

Do not apply the fresh `schema.sql` to an installation containing real data; it is a rebuild script and intentionally drops/recreates the application tables.

Do not skip migration numbers on an existing installation.
