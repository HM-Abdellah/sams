# SAMS API Contract

This document is the frontend/backend contract for the release candidate.

## API surface status

This release candidate intentionally has a migration boundary between the current legacy API and the target canonical API.

- **Current legacy surface — `/api/*.php`:** authoritative for the existing Vanilla JS frontend, including authentication and several operational/admin endpoints. These routes remain supported during the migration.
- **Canonical surface — `/api/v1/*`:** authoritative only for endpoints already migrated through `backend/public/index.php`.
- The `/api/v1/auth/*` routes described by the target architecture are **not implemented in this release candidate**. Do not assume they exist until the authentication migration is completed and verified.
- Documentation below uses the actual current route for legacy endpoints unless explicitly marked as a target/canonical route.

## Global contract

- All APIs return JSON with either `success: true` and `data`, or `success: false` and `error`.
- Authenticated requests use the SAMS session cookie.
- Mutating requests require the current `X-CSRF-Token` header.
- IDs are positive integers.
- Browser-side validation is for UX only; the API remains authoritative.
- Historical archive reads are read-only, require the `admin` role, and do not require CSRF.
- Mutations that change persistent state are transactional and audited.
- Canonical v1 JSON request bodies are capped at 1,000,000 bytes and return HTTP 413 when exceeded.
- JSON API responses include baseline security headers; HSTS is emitted only when the request is HTTPS.

## Authentication — current legacy surface

The release retains the legacy authentication endpoint for the existing UI, and now also exposes the first canonical `/api/v1/auth/*` contract used by the React migration.

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

### Canonical authentication — `/api/v1/auth/*`

#### GET `/api/v1/auth/session`

Starts the session envelope when needed and returns the current authentication state plus a CSRF token. Anonymous callers receive `authenticated: false` with a usable CSRF token.

#### POST `/api/v1/auth/login`

JSON body:

```json
{
  "sams_code": "T123456",
  "password": "..."
}
```

The SAMS Code is case-insensitive and is a login identifier, not a password. Only active accounts with a valid password can authenticate. Successful login returns the internal user id, role, school scope, and CSRF/session state. Password hashes and SAMS Code hashes are never returned.

#### POST `/api/v1/auth/logout`

Requires an authenticated session and the current `X-CSRF-Token`. The session is destroyed after the logout audit event is recorded.

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

## Administration dashboard

### GET `api/admin-dashboard.php`

Admin only. Returns the current school operational dashboard for the active academic year, including:

- school-wide summary
- statistics grouped by branch
- statistics for each active class
- students above the configured absence threshold
- active classes with no attendance records today
- recent audit activity

Branch statistics are derived from the separate class rows and are never used to grant access or merge historical classes.

## Teachers

### GET `api/teachers.php`

Admin only. Returns the teacher directory, active subjects, exact teacher/subject/class teaching assignments, and the configured recent-presence window.

### POST `api/teachers.php`

Admin only.

JSON actions:

- `assign`: `teacher_id`, `subject_id`, `class_id`
- `unassign`: `id`
- `create_subject`: `code`, `name_fr`, `name_ar`, `name_en`
- `update_subject`: `id`, `code`, `name_fr`, `name_ar`, `name_en`, optional `is_active`

A teaching assignment is unique per teacher + subject + class. Creating one also ensures the teacher has class-level access through `teacher_classes`.

### POST `api/presence.php`

Authenticated users only. Requires CSRF. Updates the user's `last_seen_at` timestamp. The admin teacher directory treats a teacher as recently active when the timestamp is within its returned presence window.

## Users

### GET `api/users.php`

Admin only. Returns all users and security state needed by the admin UI.

### POST `api/users.php`

Admin only.

JSON actions:

- `create`: `username`, `full_name`, `role`, `password`; teacher accounts may also provide `employee_id` and `phone`
- `update`: `id`, `full_name`, `role`, `is_active`; teacher accounts may also provide `employee_id` and `phone`
- `reset_password`: `id`, `password`
- `unlock`: `id`

Supported roles are exactly: `admin`, `teacher`, `counselor`.

### POST `/api/v1/admin/users`

Admin only. Requires CSRF.

JSON action `reissue_sams_code`: `id`. The response contains the new plaintext SAMS Code exactly once. The previous active code is revoked and the target user's `session_version` is incremented; user identity is preserved.

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

Admin and teacher for create/update; admin only for transfer/delete.

JSON actions:

- `create`: `first_name`, `last_name`, optional `student_number`, optional `massar_code`, optional `birth_date`
- `update`: `id` plus the same student fields
- `transfer`: `id`, `target_class_id`, `effective_date`
- `delete`: `id` (this deactivates the student)

Creating a student also creates the initial enrollment for the class academic year inside the same transaction.

A transfer is transactional: the current enrollment is closed on the day before the effective date, a new target-class enrollment starts on the effective date, and `students.class_id` is updated. Transfers are restricted to active classes in the same academic year. Existing attendance on or after the effective date blocks the transfer so historical attendance cannot be orphaned from its enrollment period.

## Canonical v1 teacher attendance

### GET `/api/v1/classes/{class_id}/attendance?week_start=YYYY-MM-DD`

Authenticated users only. The class must be active in the active academic year, and teachers may read only assigned classes. The supplied date is normalized to Monday, the six-day school-week range is clamped to academic-year boundaries when it partially overlaps the year, and a fully out-of-year week returns an empty register. The response contains the active attendance roster using only first/last names plus enrollment-aware attendance rows.

### POST `/api/v1/classes/{class_id}/attendance/bulk`

Admin and teacher only. Requires CSRF. JSON body contains `entries`, capped at 500. Each entry supports `upsert` or `delete`; upserts use the statuses `present`, `absent`, `late`, `excused`. Students must belong to the class and be active, dates must be inside the class academic year, and duplicate student/date/period keys within a batch are rejected. Signed lessons cannot be edited until reopened. The complete batch, audit records, and sign-off invalidation run in one transaction; a failure rolls the whole batch back. Exact no-op updates do not create audit noise.

The legacy attendance endpoints below remain available during the backend migration.

## Attendance

### GET `api/attendance.php?class_id=ID&month=YYYY-MM`

Returns enrollment-aware attendance rows for the month.

### GET `api/attendance.php?class_id=ID&week_start=YYYY-MM-DD`

Returns enrollment-aware attendance records for the six-day school week starting on the supplied Monday. The supplied date is normalized to the Monday of its school week, the resulting Monday-to-Saturday range is clamped to the class academic-year boundaries, and the weekly endpoint is the operational attendance view used by teachers.

The monthly GET contract remains available for compatibility and reporting, but the operational attendance screen uses the weekly endpoint.

### Attendance register sign-offs

### GET `api/attendance-signoffs.php?class_id=ID&week_start=YYYY-MM-DD`

Returns the selected Monday-to-Saturday register workflow:
- active teachers assigned to the class;
- per-lesson sign-off state (`signed` / `needs_resign`);
- weekly signature state for each teacher.

### POST `api/attendance-signoffs.php?class_id=ID`

Supported actions:
- `sign_period`: the teacher certifies the selected lesson. The saved class signature is snapshotted with the sign-off.
- `reopen_period`: the signing teacher or an administrator reopens a signed lesson for correction. The event is audited.
- `sign_week`: the teacher certifies the weekly register after their lesson sign-offs have no pending re-sign state.

A signed lesson is read-only through the attendance API. Any correction requires reopening first. A successful correction invalidates the lesson sign-off and the weekly teacher signatures for that class/week, so the register must be certified again.

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

## Canonical v1 archive, reports, and signatures

### GET `/api/v1/admin/archive?view=days&class_id=ID&month=YYYY-MM`

Admin only. Historical read of recorded attendance days for the selected class/month. The class may be inactive or belong to a historical academic year.

Supported views are `days`, `month`, `day`, and `student`.

- `days`: requires `class_id` and `month`.
- `month`: requires `class_id` and `month` and returns enrollment-aware student totals.
- `day`: requires `class_id` and `date=YYYY-MM-DD`; the date must be within the class academic year.
- `student`: requires `class_id` and `student_id` and returns that student's history within the selected class.

The canonical route is read-only, requires authentication and the `admin` role, and does not require CSRF.

### GET `/api/v1/classes/{id}/report?month=YYYY-MM`

Authenticated users with operational access to the selected class. Returns enrollment-aware monthly attendance totals for the class.

### GET `/api/v1/classes/{id}/signature`

Authenticated users with access to the selected class. Returns the current user's saved class signature, if one exists.

### POST `/api/v1/classes/{id}/signature`

Admin or teacher with access to the selected class. CSRF required. JSON body: `signature_data`, a PNG data URL up to 500,000 bytes.

### DELETE `/api/v1/classes/{id}/signature`

Admin or teacher with access to the selected class. CSRF required. The response reports whether a stored signature row was removed.

Successful signature mutations are transactional and audited. These canonical endpoints coexist with the legacy endpoints below during migration.

## Archive / history

### GET `api/archive.php?view=days&class_id=ID&month=YYYY-MM`

Admin only. Returns recorded attendance days for the selected historical class/month.

### GET `api/archive.php?view=month&class_id=ID&month=YYYY-MM`

Admin only. Returns monthly student totals for the historical class/month.

### GET `api/archive.php?view=day&class_id=ID&date=YYYY-MM-DD`

Admin only. Returns the historical class roster with attendance records for that day.

### GET `api/archive.php?view=student&class_id=ID&student_id=ID`

Admin only. Returns the student's enrollment and attendance history within the selected historical class.

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