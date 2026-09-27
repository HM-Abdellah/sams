# Phase 3 — Whole-School School Roster Import

## Goal

Accept the school's real Excel roster as the primary input, with Markdown as a controlled fallback representation when Excel parsing is unavailable. Detect every class block and its students, and produce a validated intermediate model that later layers can preview and import transactionally.

## Scope of this slice

This slice now covers the full safe import pipeline and the admin review/confirmation workflow:

1. Add PhpSpreadsheet as the spreadsheet reader.
2. Detect worksheets without assuming a fixed sheet count or row layout.
3. Detect class metadata by labels rather than row numbers.
4. Detect roster tables by Arabic header signatures rather than fixed columns.
5. Parse student identity/source fields without writing to the database.
6. Support both one class per worksheet and multiple repeated class blocks in one worksheet.
7. Preserve source coordinates for diagnostics.
8. Produce explicit issues for malformed or incomplete rows.
9. Detect duplicate Massar codes and duplicate roster numbers inside the workbook.
10. Stage normalized workbook data without touching production students/enrollments.
11. Map source classes to an exact target academic year + class name.
12. Reconcile students by global Massar identity and detect identity/enrollment conflicts; duplicate roster numbers remain non-blocking diagnostics.
13. Commit the reconciled batch in one database transaction with idempotent replay protection.
14. Provide an admin review surface for class mappings, student matches, conflicts, and explicit final confirmation.
15. Verify the Phase 2 -> Phase 3 database upgrade path for migration 005.
16. Support `.md` as a fallback input produced externally from the source workbook (for example with MarkItDown), using the same validation, staging, reconciliation, and commit pipeline.
17. Use synthetic fixtures only; never commit real student data.

## Non-goals

- No direct production writes during upload/staging.
- No automatic creation of uncertain target classes.
- No automatic overwrite of conflicting student identity data.
- No replacement of the existing CSV importer.
- No React-specific import implementation yet; the verified review workflow remains available in the current admin UI until the frontend migration replaces it.
- No automatic assumptions about branch/filière from class names.
- No automatic Excel -> Markdown conversion inside SAMS v1; Markdown is an externally produced fallback. Malformed Markdown table shapes are treated as blocking diagnostics rather than being guessed or repaired. Markdown sheets use the same 100-sheet safety cap as Excel.

## Expected intermediate model

A parsed workbook returns workbook/sheet metadata, detected class blocks, class name/level/academic year, ordered student rows, Massar/first name/last name/normalized birth date, source coordinates, optional source fields, and explicit parsing issues.

## Import pipeline

Primary path: Upload `.xlsx/.xls` -> secure file checks -> Excel parser -> topology/class detection -> row normalization -> validation -> class/student identity matching -> explicit admin confirmation -> one DB transaction.

Fallback path: Source Excel -> external MarkItDown conversion -> upload `.md` -> Markdown parser -> the same topology/detection, normalization, validation, staging, reconciliation, confirmation, and transaction path. Markdown does not bypass any safety or validation layer.

The parser must never silently guess a class or silently drop a malformed student row.

## Reconciliation and final import

The whole-school staging model is deliberately separate from the legacy class-scoped importer.

Class mapping is deterministic: each staged source class must resolve to an existing class with the selected target academic year and the source class name. A missing target class is a blocking error; the importer does not silently create a new class or infer branch/filière.

Student reconciliation uses Massar as the primary identity key. An existing Massar reuses the existing `students.id`; a new Massar creates exactly one student record. Existing first name, last name, and non-null birth date are compared before import. Conflicts are persisted on the staging row and block the final commit. The source `ر.ت`/roster number remains staging metadata only; it is not treated as `students.student_number`.

Enrollments are year-specific. An existing student already enrolled once in the target academic year is reused only when that enrollment belongs to the mapped target class. An enrollment in another target-year class, or multiple target-year enrollments, blocks the import. A missing target-year enrollment is created during the final transaction.

The final commit is atomic: student rows, enrollment rows, staging state changes, and the final audit event are part of one database transaction. A production write failure rolls the complete batch back, leaving the staged batch retryable. A committed batch is idempotent and will not create duplicate students/enrollments on a second commit attempt.

## Attendance UI invariant

The workbook can contain rich student metadata, but the attendance register must continue to display only the student's first name + last name and attendance periods such as 8–9, 9–10, etc.

## Source-format policy

Excel remains the canonical/source-of-truth school roster format. Markdown is a fallback/derived representation intended for parser recovery, not a replacement for Excel. The fallback must pass exactly the same staging, validation, reconciliation, authorization, and transaction checks.

## Database staging slice

Migration 005 adds three dedicated staging tables:

- `school_import_batches`: one record per uploaded school workbook, including the explicit target academic year when selected.
- `school_import_classes`: one record per detected class block, with source sheet/row coordinates and an optional target class mapping.
- `school_import_rows`: one record per detected student row, with source coordinates, identity fields, validation state, match state, and links to an existing student/enrollment when reconciliation is performed.

The legacy `student_import_batches` / `student_import_rows` tables remain untouched while the new importer is validated.

The schema intentionally does not store a copy of the complete uploaded workbook. Only normalized staging data and diagnostics are persisted.
## HTTP staging/preview contract

POST /api/v1/imports/school
  multipart/form-data:
    file
    target_academic_year_id (optional during analysis)

GET /api/v1/imports/school/{batch_id}

GET /api/v1/imports/school/{batch_id}?class_id={import_class_id}&page=1&per_page=50

POST /api/v1/imports/school/{batch_id}/reconcile

POST /api/v1/imports/school/{batch_id}/commit

The upload endpoint is admin-only, requires the existing SAMS session and CSRF token, validates the uploaded file before parsing, stages normalized rows transactionally, and returns a summary rather than the complete student dataset.

The preview endpoint is admin-only. It returns batch/class summaries by default; student rows are fetched only for a class and are paginated with a hard maximum page size of 100.

The reconcile endpoint is admin-only and performs target-class mapping plus Massar reconciliation against the production database, but it does not create production student/enrollment rows.

The commit endpoint is admin-only and requires a fully reconciled batch. It rechecks target class identity, student identity, and enrollment state under locks before performing the atomic final import. Roster numbers remain source diagnostics only and do not participate in production identity or locking. Unresolved conflicts return HTTP 409 and do not write production records.


## Verification gates

The Phase 3 CI gate must execute, not merely discover, all of the following on the Phase 3 head:

- JavaScript syntax check.
- PHP lint.
- Legacy service tests.
- Backend PHPUnit suite.
- Migration 005 upgrade-path test against the Phase 2 schema.
- MariaDB integration tests.
- Whole-school reconciliation/atomic-commit integration tests.
- API HTTP smoke tests, including protected reconciliation authorization.
- Playwright E2E, including the admin upload -> review -> reconcile -> explicit confirmation -> commit journey.

A successful green gate is required before treating this phase as ready for review. The real school workbook and its MarkItDown-generated `.md` are used only as external acceptance inputs and are not stored in the repository. Synthetic fixtures must remain the only repository test data.


## External acceptance

The real school workbook and its MarkItDown-generated `.md` are kept outside the repository. External source-equivalence verification confirmed that the production-shaped workbook topology is compatible with the Phase 3 parser after the metadata/header compatibility fix. Full production-staging/commit acceptance must still run in an isolated environment with a target database.

Observed external workbook shape:
- 27 worksheets / class blocks.
- 921 student rows.
- One class per worksheet.
- Academic year consistently represented as 2025/2026.
- Real metadata labels include the `:` prefix form (for example `: القسم` and `: المستوى`) and the workbook uses `تاريخ الإزدياد` for the birth-date header.
- The corresponding MarkItDown output preserved the same 27 sheets, 27 classes, and 921 student rows.
- The Excel and Markdown representations matched on class metadata and student identity/date fields except for three source-conversion differences: two numeric `137` birth-place cells became `NaN` in Markdown, and one last-name cell collapsed an internal double space to a single space.

Real student data must not be committed to the repository. The repository test suite continues to use synthetic fixtures only.
