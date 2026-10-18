# SAMS — Frontend Reconstruction Map

Status: Phase 1 reconnaissance, 2026-09-29

## 1. Reconnaissance result

The repository currently has no React application directory. The active browser UI is a PHP-rendered legacy shell backed by Vanilla ES modules.

Legacy entry points:

- `public/index.php`
- `public/login.php`

Legacy frontend modules:

- `public/assets/js/app.js`
- `public/assets/js/api.js`
- `public/assets/js/auth.js`
- `public/assets/js/state.js`
- `public/assets/js/logic.js`
- `public/assets/js/ui.js`
- `public/assets/js/reports.js`
- `public/assets/js/signature.js`
- `public/assets/js/i18n.js`

Legacy styling:

- `public/assets/css/style.css`
- `public/assets/css/login.css`
- `public/assets/css/print.css`

The legacy application is a single PHP page containing seven product panels and seven dialogs, with dynamic event wiring concentrated in `app.js` and rendering concentrated in `ui.js`.

Measured repository facts:

- legacy main page: 389 lines
- legacy `app.js`: 1,717 lines
- legacy `ui.js`: 753 lines
- legacy `api.js`: 175 lines
- legacy `state.js`: 76 lines
- legacy `logic.js`: 57 lines
- legacy `i18n.js`: 155 lines
- legacy stylesheet: 208 lines
- legacy login stylesheet: 1 minified line
- main page: 123 unique DOM ids
- main page: 11 forms
- main page: 7 dialogs
- main page: 7 product panels
- legacy event/DOM wiring references: 376 occurrences
- supported legacy languages: French, Arabic, English

Conclusion:

The correct strategy is a frontend reconstruction rather than a mechanical Vanilla-JS-to-React translation.

## 2. Product capabilities discovered

### Authentication

Current legacy entry:
- PHP login shell
- legacy `api/auth.php?action=login`

Target canonical contract:
- `GET /api/v1/auth/session`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`

Important difference:
- legacy login accepts `username`
- canonical login accepts `sams_code`

The React login must follow the canonical SAMS Code contract.

### Teacher attendance

Primary legacy surface:
- week selector
- six school days
- eight daily periods
- student search
- risk/regular filters
- present / absent / late / excused / clear state model
- signed / needs-resign workflow
- weekly teacher certification
- administration receipt
- mobile attendance list
- desktop attendance table

Canonical:
- `GET /api/v1/classes/{id}/attendance?week_start=YYYY-MM-DD`
- `POST /api/v1/classes/{id}/attendance/bulk`

Legacy-only compatibility still used by the current UI:
- weekly attendance legacy endpoint
- legacy sign-off endpoint

### Students

Current capabilities:
- list
- create
- edit
- deactivate
- transfer
- student history through archive

Canonical student resource is not currently mounted in `backend/public/index.php`.

Decision:
- React API adapter may continue to use `/api/students.php` during migration.
- Do not invent `/api/v1/classes/{id}/students` until backend migration actually provides and verifies it.

### Classes

Current capabilities:
- operational class list
- admin all-class list
- create
- update
- activate/deactivate

Canonical currently mounted:
- `GET /api/v1/admin/classes`
- `POST /api/v1/admin/classes`

Legacy compatibility remains for the current operational class selector.

Decision:
- central API layer hides whether a feature currently uses v1 or legacy transport.

### Teachers / teaching assignments

Current capabilities:
- teacher directory
- presence status
- subject management
- teacher ↔ subject ↔ class teaching assignments
- teacher ↔ class access compatibility assignments

Canonical:
- `GET/POST /api/v1/admin/teachers`
- `GET/POST/DELETE /api/v1/admin/teacher-classes`

### Users / account lifecycle

Current capabilities:
- list users
- create
- update
- reset password
- unlock
- set status
- revoke sessions
- reissue SAMS Code

Canonical:
- `GET/POST /api/v1/admin/users`

Legacy compatibility remains for several operational user actions during migration.

### Admin dashboard

Current capabilities:
- school summary
- branch statistics
- per-class statistics
- students above absence threshold
- classes with no attendance today
- recent audit activity
- teacher presence/activity

Canonical:
- `GET /api/v1/admin/dashboard`

### Academic years

Current capabilities:
- list
- create
- activate

Canonical:
- `GET/POST /api/v1/admin/academic-years`

### Onboarding

Canonical-only product flow:
- `POST /api/v1/onboarding/request`
- `GET /api/v1/onboarding/status`
- `POST /api/v1/onboarding/activate`
- admin request list/review/code rotation under `/api/v1/admin/onboarding/*`

The React application must treat onboarding as a first-class flow, not as a legacy UI port.

### Imports

Two different domains exist:

1. Student CSV import — currently legacy API.
2. Whole-school workbook import — canonical v1 API:
   - `POST /api/v1/imports/school`
   - `GET /api/v1/imports/school/{id}`
   - `POST /api/v1/imports/school/{id}/reconcile`
   - `POST /api/v1/imports/school/{id}/commit`

The API layer must keep these distinct.

### Archive / history

Canonical:
- `GET /api/v1/admin/archive`

Legacy compatibility:
- archive day/month/student routes remain operational during migration.

### Reports

Canonical:
- `GET /api/v1/classes/{id}/report`

Legacy:
- monthly report route remains supported.

### Signatures

Canonical:
- `GET/POST/DELETE /api/v1/classes/{id}/signature`

Legacy compatibility exists and should not be removed before replacement verification.

### Audit

Canonical:
- `GET /api/v1/admin/audit`

Legacy:
- `api/audit.php` remains supported during migration.

## 3. Legacy → React reconstruction map

| Legacy area | Preserve as behavior | React feature | Initial transport |
|---|---|---|---|
| login.php + auth.js | authentication UX, errors, session entry | features/auth + AuthPage | canonical v1 |
| index shell | global navigation context | app shell + route layout | N/A |
| attendance panel | weekly register workflow | features/attendance | canonical attendance + legacy sign-off until migrated |
| student panel | roster CRUD/transfer | features/students | legacy |
| statistics panel | week analytics | features/attendance or stats | derive from server data / existing contract |
| signature panel | signature workflow | features/signatures | canonical v1 |
| archive panel | historical reads | features/archive | canonical v1 where mounted |
| teachers panel | directory + teaching management | features/teachers | canonical v1 |
| admin panel | school operations | features/admin | canonical v1 + legacy compatibility |
| CSV import UI | staging/revalidation/import | features/imports | legacy |
| whole-school import UI | stage/reconcile/commit | features/imports | canonical v1 |
| i18n.js | FR/AR/EN content and behavior | i18n layer | React |
| state.js | state categories, not structure | feature-local/server state | React |
| ui.js | rendering requirements only | React components | React |
| app.js | workflows and edge cases only | feature hooks/actions | React |
| style.css/login.css | no visual preservation required | new design foundation | React/Tailwind |

## 4. React information architecture

Initial route/domain model:

```
app/
  shell/
  routes/
  session/

pages/
  auth/
  teacher/
  admin/
  onboarding/

features/
  auth/
  attendance/
  students/
  classes/
  teachers/
  onboarding/
  imports/
  archive/
  reports/
  signatures/
  administration/
```

Shared UI:

```
components/
  ui/
  layout/
  attendance/
```

The exact file tree remains an implementation decision after Phase 2 architecture review.

## 5. State ownership reconstruction

### Server state

- session/authentication
- classes
- students
- attendance
- sign-offs
- teachers
- teaching assignments
- users
- admin dashboard
- academic years
- imports
- archive
- reports
- signatures
- audit

### UI / interaction state

- selected route
- selected class
- selected week/day/period
- search/filter
- dialogs/drawers
- optimistic attendance edits
- pending/retry state
- language/direction preference
- theme preference

### Critical rule

Do not reproduce the legacy global `state` object as a React global state dump.

## 6. Attendance reconstruction requirements

The following behavior is considered critical and must survive:

- six-day school week
- eight periods/day
- attendance status semantics
- enrollment-aware roster
- server-authoritative save
- batch writes
- failed batch recovery
- signed lesson protection
- explicit reopen before correction
- signoff invalidation after correction
- weekly certification
- administration receipt
- mobile-first operational workflow without changing business truth

The final visual interaction is intentionally not defined in Phase 1.

## 7. Responsive reconstruction requirements

Legacy already distinguishes desktop and mobile attendance rendering.

React must not simply shrink the desktop table.

Expected design investigation:

- desktop full-register scanning
- mobile day → period → student workflow
- touch-friendly controls
- preserving context while navigating
- reduced interaction cost for repeated attendance marking

Exact interaction model belongs to Design R&D.

## 8. Internationalization requirements

Existing production content covers:

- French
- Arabic
- English

React must preserve the product requirement while rebuilding the implementation.

The visual system must support both LTR and RTL without maintaining separate component implementations.

## 9. Security reconstruction requirements

Never move these authorities into React:

- authentication authority
- role authorization
- school/tenant boundaries
- attendance integrity
- signed lesson protection
- enrollment truth
- account lifecycle
- audit truth

React may provide UX affordances and optimistic interaction, but the backend remains authoritative.

## 10. Legacy removal strategy

A legacy asset can be removed only after:

1. dependency audit
2. replacement exists
3. behavior parity verified
4. API contract verified
5. relevant E2E path verified
6. production/reference path verified
7. legacy references removed

No blind deletion.

## 11. Documentation inconsistencies discovered during reconnaissance

Two architecture/API statements were stale relative to the mounted backend routes:

- `docs/API_CONTRACT.md` incorrectly stated that canonical auth was not implemented, while canonical auth routes are mounted.
- `docs/ARCHITECTURE.md` carried the same stale target-auth statement.

These are documentation inconsistencies, not backend defects.

They should be corrected so the React implementation has one unambiguous contract source.

## 12. Phase 1 gate

Status: PASS

Reason:

- repository structure inspected
- legacy frontend surface enumerated
- frontend entry points inspected
- frontend state/render/event architecture identified
- API client inventory inspected
- canonical router inspected
- backend architecture/engineering rules inspected
- API migration boundary identified
- React reconstruction domains identified
- legacy removal criteria defined
- documentation inconsistencies isolated

Next phase:

# PHASE 2 — FRONTEND ARCHITECTURE

No final visual design work starts before the engineering architecture is stable.

### Admin Students
Phase 34 adds the role-aware admin route `/app/admin/students`.

Current contract:
- class context is selected explicitly and preserved in `class_id` URL state;
- roster search/filter/sort and lifecycle controls use the existing `/api/students.php?class_id=ID` migration contract;
- create/update/deactivate/transfer remain server-authoritative;
- transfer continues through the existing StudentTransferService integrity rules;
- no new canonical v1 student endpoint is claimed until backend migration provides and verifies it.

The legacy student API remains intentional migration compatibility, not a new product transport decision.

### Admin Classes
Phase 34 adds search/filter/sort, current relationship counts, and a direct roster action from each class row.
