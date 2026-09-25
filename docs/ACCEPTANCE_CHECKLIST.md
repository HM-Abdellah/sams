# SAMS — Release Acceptance Checklist

Use this checklist on a clean database before the 2026-09-28 release freeze.

## 1. Environment

- PHP runtime starts successfully.
- MariaDB/MySQL is reachable.
- The local config file contains only environment-specific credentials and is not committed.
- database/schema.sql can recreate the full schema from empty state.

## 2. Initial school configuration

- Create the first administrator.
- Create/activate one academic year.
- Create at least two classes.
- Create two teachers and one counselor.
- Assign teachers to classes.
- Confirm teachers can only access assigned operational classes.

## 3. Student lifecycle

- Add a student manually.
- Edit the student's identity fields.
- Deactivate a student.
- Stage a valid CSV import.
- Stage a CSV containing invalid/duplicate rows.
- Correct invalid rows.
- Revalidate the batch.
- Import the validated batch.
- Confirm every imported student has an enrollment.
- Confirm an import cannot be modified after completion.

## 4. Attendance workflow

- Open a teacher class.
- Mark present, absent, late, and excused statuses.
- Clear a status.
- Mark multiple cells quickly.
- Confirm the browser batches the changes through the bulk endpoint.
- Reload and confirm the persisted state.
- Change class/month after edits and confirm pending changes are flushed.
- Verify invalid attendance is rejected by the API.

## 5. Archive and reporting

- Open the monthly archive.
- Open a day from the archive.
- Open a student's historical attendance.
- Generate the monthly/statistical report.
- Generate the printable attendance sheet.
- Save, reload, and clear a class signature.
- Transfer a student between classes.
- Confirm historical attendance remains attached to the previous enrollment/class.

## 6. Security and reliability

- Unauthenticated users are redirected to login.
- CSRF-protected mutations reject an invalid token.
- Teachers cannot access another teacher's class.
- Teachers cannot access admin functions.
- Inactive users cannot authenticate.
- Logout removes the authenticated session.
- Session-version changes invalidate stale sessions.
- Database transactions roll back on failed multi-step mutations.
- No raw SQL errors or sensitive configuration are returned to users.

## 7. Browser coverage

Run the critical flows on:

- Desktop Chromium.
- Mobile Chromium.
- A narrow viewport suitable for teacher phone usage.

## 8. Release gate

Release is accepted only when:

- PHP lint is green.
- Service tests are green.
- MariaDB integration tests are green.
- JavaScript syntax checks are green.
- Playwright E2E is green.
- Clean-school acceptance completes without manual database repair.
- No known critical authentication or data-integrity blocker remains.
- Deployment and backup instructions are present.
- Demo/presentation data is separated from real school data.

## 9. Freeze rule

After acceptance and through 2026-09-28:

- Bug fixes are allowed.
- Security and validation fixes are allowed.
- Deployment/documentation fixes are allowed.
- New feature scope and architecture rewrites are deferred to the post-release backlog.
