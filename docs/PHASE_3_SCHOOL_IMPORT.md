# Phase 3 — Whole-School Excel Import

## Goal

Accept the school's real Excel roster as a single workbook, detect every class block and its students, and produce a validated intermediate model that later layers can preview and import transactionally.

## Scope of this slice

This slice is intentionally parser-only:

1. Add PhpSpreadsheet as the spreadsheet reader.
2. Detect worksheets without assuming a fixed sheet count or row layout.
3. Detect class metadata by labels rather than row numbers.
4. Detect roster tables by Arabic header signatures rather than fixed columns.
5. Parse student identity/source fields without writing to the database.
6. Support both one class per worksheet and multiple repeated class blocks in one worksheet.
7. Preserve source coordinates for diagnostics.
8. Produce explicit issues for malformed or incomplete rows.
9. Use synthetic fixtures only; never commit real student data.

## Non-goals

- No database writes.
- No student/enrollment reconciliation yet.
- No replacement of the existing CSV importer.
- No React UI yet.
- No automatic assumptions about branch/filière from class names.

## Expected intermediate model

A parsed workbook returns workbook/sheet metadata, detected class blocks, class name/level/academic year, ordered student rows, Massar/first name/last name/normalized birth date, source coordinates, optional source fields, and explicit parsing issues.

## Import pipeline

Upload .xlsx/.xls -> secure file checks -> workbook parser -> topology/class detection -> row normalization -> preview + validation -> class/student identity matching -> explicit admin confirmation -> one DB transaction.

The parser must never silently guess a class or silently drop a malformed student row.

## Later database slice

The existing class-scoped student_import_batches design is not the final model for a whole-school workbook. Before commit/import is implemented, the domain layer must define target academic year, class identity within an academic year, Massar-based student identity reuse, enrollment creation/reuse, conflict handling, and atomic rollback.

## Attendance UI invariant

The workbook can contain rich student metadata, but the attendance register must continue to display only the student's first name + last name and attendance periods such as 8–9, 9–10, etc.