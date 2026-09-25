# SAMS API Contract

This document is the frontend/backend contract for the release candidate.

## Global contract

- All APIs return JSON with either `success: true` and `data`, or `success: false` and `error`.
- Authenticated requests use the SAMS session cookie.
- Mutating requests require the current `X-CSRF-Token` header.
- IDs are positive integers.
- Browser-side validation is for UX only; the API remains authoritative.
- Historical archive reads are read-only and do not require CSRF.
- Mutations that change persistent state are transactional and audited.

## Authentication

### GET `api/auth.php?action=session`

Returns the current authentication state and CSRF token.

### POST `api/auth.php?action=login`

JSON body:

```json
{
  "username": "admin",
  "password": "..."
}
```

### POST `api/auth.php?action=logout`

Ends the current session. Requires CSRF.

## Classes

### GET `api/classes.php`

Without query parameters, returns operational classes visible to the current role. Operational visibility is limited to active classes in the active academic year.

For administrators, `?scope=all` returns all classes, including inactive classes and classes from historical academic years, for administration only.

### POST `api/classes.php`

Admin only.

JSON actions:

- `create`: `name`, optional `level`, optional `branch`
- `update`: `id`, `name`, optional `level`, optional `branch`
- `activate`: `id`
- `deactivate`: `id`

## Users

### GET `api/users.php`

Admin only. Returns all users and security state needed by the admin UI.

### POST `api/users.php`

Admin only.

JSON actions:

- `create`: `username`, `full_name`, `role`, `password`
- `update`: `id`, `full_name`, `role`, `is_active`
- `reset_password`: `id`, `password`
- `unlock`: `id`

Supported roles are exactly: `admin`, `teacher`, `counselor`.

## Teacher/class assignments

### GET `api/teacher-classes.php?class_id=ID`

Admin only. Returns teachers assigned to the class.

### GET `api/teacher-classes.php?teacher_id=ID`

Admin only. Returns classes assigned to the teacher.

### POST `api/teacher-classes.php`

Admin only. JSON: `teacher_id`, `class_id`.

### DELETE `api/teacher-classes.php`

Admin only. JSON: `teacher_id`, `class_id`.

## Academic years

### GET `api/academic-years.php`

Admin and counselor.

### POST `api/academic-years.php`

Admin only.

JSON actions:

- `create`: `name`, `starts_on`, `ends_on`, optional `activate`
- `activate`: `id`

Only one academic year may be active.

## Students

### GET `api/students.php?class_id=ID`

Returns the operational roster for a class.

### POST `api/students.php?class_id=ID`

Admin and teacher.

JSON actions:

- `create`: `first_name`, `last_name`, optional `student_number`, optional `massar_code`, optional `birth_date`
- `update`: `id` plus the same student fields
- `delete`: `id` (admin only; this deactivates the student)

Creating a student also creates the initial enrollment for the class academic year inside the same transaction.

## Attendance

### GET `api/attendance.php?class_id=ID&month=YYYY-MM`

Returns enrollment-aware attendance rows for the month.

### POST `api/attendance.php`

Admin and teacher.

Single-entry JSON action:

```json
{
  "action": "upsert",
  "class_id": 12,
  "student_id": 34,
  "attendance_date": "2026-09-25",
  "period": 1,
  "status": "absent"
}
```

Supported statuses: `present`, `absent`, `late`, `excused`.

Bulk action:

```json
{
  "action": "bulk",
  "class_id": 12,
  "entries": [
    {
      "student_id": 34,
      "attendance_date": "2026-09-25",
      "period": 1,
      "action": "upsert",
      "status": "absent"
    }
  ]
}
```

A bulk request is capped at 500 entries and is handled as one database transaction.

### DELETE `api/attendance.php`

JSON: `student_id`, `attendance_date`, `period`, with optional `class_id`.

## Signatures

### GET `api/signatures.php?class_id=ID`

Returns the current class signature for users who can access the class.

### POST `api/signatures.php?class_id=ID`

Admin and teacher. JSON: `signature_data`.

### DELETE `api/signatures.php?class_id=ID`

Admin and teacher.

## Reports

### GET `api/reports.php?class_id=ID&month=YYYY-MM`

Returns monthly enrollment-aware student attendance totals.

## Audit

### GET `api/audit.php`

Admin only.

Supported filters include `user_id`, `action`, `entity_type`, `from`, `to`, `page`, and `per_page` as implemented by the endpoint.

## Student imports

### GET `api/imports.php?class_id=ID`

Returns the import batches for a class.

### GET `api/imports.php?batch_id=ID`

Returns one batch and its staged rows.

### POST multipart `api/imports.php`

Stage a CSV:

- field `action=stage`
- field `class_id`
- field `file`

CSV required columns:

- `first_name`
- `last_name`
- `massar_code`
- `birth_date`

Optional:

- `student_number`

The current implementation limits the uploaded CSV to 5 MB and 2,000 non-blank student rows.

### POST JSON `api/imports.php`

Actions:

- `correct`: `batch_id`, `row_id`, corrected student fields
- `revalidate`: `batch_id`
- `import`: `batch_id`

Import is allowed only when every row is valid. Student creation, enrollment creation, staged-row linking, batch state update, and audit records are committed together.

## Archive / history

### GET `api/archive.php?view=days&class_id=ID&month=YYYY-MM`

Returns recorded attendance days for the selected historical class/month.

### GET `api/archive.php?view=month&class_id=ID&month=YYYY-MM`

Returns monthly student totals for the historical class/month.

### GET `api/archive.php?view=day&class_id=ID&date=YYYY-MM-DD`

Returns the historical class roster with attendance records for that day.

### GET `api/archive.php?view=student&class_id=ID&student_id=ID`

Returns the student's enrollment and attendance history within the selected historical class.

Historical access is intentionally separate from operational class access so archived records remain readable after the active academic year changes.

## Error meanings

Common status codes:

- `401`: authentication required
- `403`: authenticated but not authorized
- `404`: resource not found
- `405`: unsupported method
- `409`: duplicate/conflicting state
- `419`: invalid CSRF token
- `422`: validation error
- `500`: unexpected server error

The frontend should display the returned `error` message without parsing server internals.

## Release rule

Do not make frontend code depend on fields or endpoints not listed here unless the backend contract is deliberately changed and this document is updated in the same change.
