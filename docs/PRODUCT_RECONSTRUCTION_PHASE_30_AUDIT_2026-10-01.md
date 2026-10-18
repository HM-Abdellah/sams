# SAMS — Phase 30 Baseline + Product Workflow Reconciliation

Date: 2026-10-01
Branch: reconstruction/product-system-2026-10-01
Base runtime: main 64a081294f7ec08612c85007d671aeb13f49c4c6

## Result

Phase 30 audit confirms that the existing SAMS foundation is suitable for progressive reconstruction. No runtime application code was changed during this phase.

## Verified foundation
- React + TypeScript + Vite + Tailwind frontend.
- PHP 8.3 backend with REST/JSON API and a legacy compatibility boundary.
- MariaDB/MySQL relational model with academic years, classes, students, enrollments, teachers, subjects, assignments, attendance, signatures, imports, and audit logs.
- Server-side role and school-scope enforcement exists.
- Teacher class access is enforced through server-side assignment checks.
- Attendance writes use transactions and class-level locking during the save workflow.
- Existing security/red-team work includes a closed Massar cross-school isolation finding.
- Existing responsive/accessibility/testing foundations must be preserved.

## Current product surfaces
### Admin
Current routes include dashboard, classes, teachers, users, onboarding, academic years, imports, archive, and audit.
Target product direction additionally calls for stronger calendar, attendance operations, reports, alerts, and connected management workspaces.

### Teacher
Current routes include dashboard, classes, class details, attendance, students, signatures, and reports.
Target journey: Teacher Home → My Classes → Class Workspace → Attendance / Students / Reports / Signatures.

### Counselor
Current route is a read-only dashboard. It currently reuses the class-loading path used by teachers and is intentionally scheduled for a dedicated semantic/UX review rather than being treated as a separate social workspace.

## Confirmed architectural gaps to resolve

### G-01 — Teacher ↔ Subject ↔ Class authority
Database has both `teacher_classes` and `teacher_teachings`.
`teacher_teachings` models teacher + subject + class, while `teacher_classes` acts as a broader class-access relation.
The current attendance authorization uses `teacher_classes`.
Decision required: define which relationship is authoritative for attendance access and how subject-specific teaching assignments map to attendance sessions.

### G-02 — Attendance has no subject binding
`attendance` currently stores student, enrollment, date, period, status, and recorder, but no `subject_id`.
The attendance API also does not carry subject context.
The target UX explicitly requires Class + Date/Week + Subject + Period context.
Do not fake a subject in the UI. Resolve the underlying business/data model first.

### G-03 — Lesson/session identity is not subject-aware
`attendance_signoffs` is unique by class + date + period and stores one teacher on the signoff row.
This may be correct only if one period is guaranteed to represent one lesson/session, but the current model does not encode the timetable/subject relationship needed to prove that assumption.
This must be investigated before shared multi-teacher attendance and signature redesign.

### G-04 — Teacher Home is currently class listing oriented
The current Teacher Dashboard primarily presents assigned classes and links into attendance/students.
It does not yet express the intended daily-work surface: today's classes, progress, alerts, and recent activity.

### G-05 — Class Workspace is incomplete
Current class details expose summary and a limited student roster.
The target shared workspace also needs assigned teachers, subjects, attendance health, reports, and activity where supported by the backend.

### G-06 — Admin dashboard depth
Current dashboard exposes summary metrics, class statistics, online teacher count, attention students, classes without any records today, and recent audit.
Target direction additionally calls for operational attendance distribution, trend analysis, incomplete-period detection, richer needs-attention states, class health, drill-down, and a usable teacher presence list.
Metric semantics must be validated against stored attendance before adding new visualizations.

### G-07 — Mobile attendance interaction model
The current implementation uses a wide attendance table with a large minimum width and horizontal overflow.
The target design direction requires deliberate mobile attendance interaction: readable student records and intentional period navigation/scroll without making the entire workflow feel like a desktop table squeezed onto a phone.
This is a major Phase 37 reconstruction target.

### G-08 — Teacher/counselor class API semantics
The current frontend class hook uses the legacy `classes.php` transport for both teacher and counselor surfaces.
Backend behavior is role-aware and school-scoped, but the frontend abstraction is semantically teacher-named.
Phase 32/36 will separate role semantics without changing transport blindly.

### G-09 — Live collaboration is not yet implemented as a shared awareness layer
Attendance is shared at the class level and protected by class access checks, but there is no completed active-editor presence, last-updated awareness, or stale-write conflict UX.
Phase 38 will design this without introducing a standalone Collaboration page.

### G-10 — Concurrency needs stale-client protection
Save transactions lock the class during the write sequence, but class-level locking alone does not prove protection against a stale client overwriting a newer committed value.
Phase 38 must evaluate versioning/optimistic concurrency or an equivalent server-authoritative conflict mechanism.

## Requirements mapped from real-world feedback
- Admin needs teacher online/presence visibility, not only a count.
- Admin needs operational statistics that help identify where intervention is needed.
- Teacher should have a meaningful interactive home before attendance.
- A class is a shared workspace containing students and assigned teachers.
- One teacher can teach multiple classes; one class can have multiple teachers.
- Only assigned teachers can access a class.
- Assigned teachers on the same class must share the same attendance state.
- Attendance must expose 8 daily periods, with 4 morning + 4 afternoon.
- Desktop can show all periods together; mobile must use deliberate horizontal/compact navigation.
- Attendance context must identify class, date/week, subject, and period.
- Save state and shared-awareness feedback must be visible without becoming a separate collaboration product.
- XLSX import must remain staged and transparent.

## Phase dependencies
Phase 31 depends on this baseline for component/responsive contracts.
Phase 33 depends on metric semantics and dashboard data capabilities.
Phase 36 depends on class/teacher/subject relationship decisions.
Phase 37 depends on attendance session/subject context decisions.
Phase 38 depends on the resolved attendance identity and concurrency model.
Phase 39 depends on canonical metric definitions.

## Phase 30 exit status
Baseline audit complete.
Requirements and technical gaps recorded.
No runtime code changed.
Roadmap remains the source of truth for the next phase.
Next: Phase 31 — Design System + Responsive Foundation.