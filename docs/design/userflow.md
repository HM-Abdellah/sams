# SAMS — User Flows

Status: Canonical interaction flow contract
Scope: login, authenticated product flows, onboarding, and administrative operations

## 1. Global entry flow

~~~text
Open SAMS
   ↓
Session check
   ├── authenticated → role workspace
   └── unauthenticated → Login
~~~

The login page is shared. Do not create separate visual login pages for each role.

## 2. Login

~~~text
Login
  ↓
Choose language
  ↓
Enter identifier
  ↓
Enter password
  ↓
Submit
  ├── loading → prevent duplicate submission
  ├── invalid/unavailable → readable error + preserved form context
  └── success → server-authorized role workspace
~~~

Login design anchor:
- same typography and neutral visual language as the authenticated application;
- current implementation uses a two-column desktop composition and a single-column mobile composition;
- the left visual panel is secondary to the login task and must not be copied into authenticated pages.

## 3. Administration flow

~~~text
Admin login
   ↓
Admin shell
   ├── Overview
   │    └── Dashboard
   │
   ├── People
   │    ├── Classes
   │    ├── Teachers
   │    ├── Users
   │    └── Onboarding
   │
   └── Operations
        ├── Academic years
        ├── Imports
        ├── Archive
        └── Audit
~~~

Admin navigation is persistent on large screens and must remain recognizable across all admin pages.

### Admin page pattern

~~~text
Application shell
  ↓
Page header
  ↓
Optional actions
  ↓
Filters / search / toolbar
  ↓
Primary data surface
  ↓
Secondary supporting surfaces
  ↓
Feedback / recovery where needed
~~~

Do not force every page to contain every step.

## 4. Teacher flow

~~~text
Teacher login
    ↓
Teacher home
    ↓
My Classes / assigned context
    ↓
Class workspace
    ├── Attendance
    ├── Students
    ├── Statistics
    ├── Reports
    └── Signature
~~~

Teacher navigation is intentionally smaller than admin navigation.

## 5. Teacher attendance flow

~~~text
Open attendance
    ↓
Confirm class + week/date
    ↓
Select day
    ↓
Select period
    ↓
Review current saved state
    ↓
Search/filter roster when needed
    ↓
Set student attendance state
    ↓
Review operational counts
    ↓
Save
    ├── saving
    ├── saved
    └── error → retry without discarding visible work
    ↓
Sign when workflow requires
    ↓
Protected state
~~~

The user must always understand the active class and date/period before changing a student state.

## 6. Attendance status flow

~~~text
Unmarked
   ↓
Present / Absent / Late / Excused
   ↓
Local visual feedback
   ↓
Save
   ↓
Server-confirmed state
~~~

If a signed/protected lesson is edited through an allowed workflow, the UI must explain the protection/re-sign consequence rather than silently changing data.

## 7. Teacher class flow

~~~text
Teacher Classes
   ↓
Select assigned class
   ↓
Class Workspace
   ├── attendance entry
   ├── roster inspection
   ├── statistics
   └── reports/signature where authorized
~~~

Do not expose classes or actions that the server does not authorize.

## 8. Admin Classes flow

School class creation is driven by the school roster import, not arbitrary manual student-by-student creation.

~~~text
Import XLSX
   ↓
Parse
   ↓
Validate
   ↓
Detect classes / students
   ↓
Preview
   ↓
Admin confirmation
   ↓
Atomic reconciliation/import
   ↓
Classes + students available
~~~

Classes search should use the current product model:
- Search;
- academic year;
- study level such as TC / 1BAC / 2BAC.

Do not introduce Student Active/Inactive or class Status/Sort filters unless the product model explicitly changes.

## 9. Admin Students flow

~~~text
Students
   ↓
Search
   ↓
Select Class
   ↓
Class-grouped results
   ↓
Student details
~~~

Select Class groups classes by study level where appropriate.

Do not add a student Active/Inactive status to the visual model.

## 10. Admin Teachers / teaching assignments flow

~~~text
Teachers
   ↓
Review teacher directory
   ↓
Assign teaching
    ├── teacher
    ├── subject
    └── class
   ↓
Save
   ↓
Updated assignment list
~~~

For destructive/unassign actions:
- make the action visibly secondary;
- require explicit confirmation;
- show failure without losing unrelated form state.

## 11. Import flow

~~~text
Select XLSX
   ↓
Upload
   ↓
Extraction / processing
   ↓
Validation
   ↓
Preview
   ↓
Corrections if supported
   ↓
Confirm
   ↓
Commit
   ↓
Result summary
~~~

Never present a staged import as committed until the server confirms the transaction.

## 12. Report / archive flow

~~~text
Open report/archive
   ↓
Choose relevant context
   ↓
Generate/open
   ↓
Inspect
   ↓
Print/export where supported
~~~

Distinguish historical/read-only inspection from editing workflows.

## 13. Error and interruption principles

For network/API failures:
- preserve visible user work when safe;
- explain current state;
- provide retry;
- never expose backend internals;
- do not claim a mutation succeeded without server confirmation.

For session expiration:

~~~text
Request
  ↓
Unauthorized
  ↓
Session recovery / return to login
  ↓
Do not invent local authorization
~~~

## 14. Responsive flow rules

The flow stays conceptually identical across sizes, but composition changes.

Phone:
context → task → local controls → one record interaction

Desktop:
context + controls → dense data surface → supporting information

Responsive design may reorder or regroup controls when that lowers interaction cost.

## 15. Flow change rule

Before adding a page, ask:
- What user goal requires it?
- Which existing flow does it extend?
- Does it create a new role/action?
- Does the backend already support it?

A visual screen without a valid product flow is not a valid SAMS screen.
