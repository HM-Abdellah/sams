# SAMS — Product Reconstruction Phase 34
## Admin Management Workspaces
### 2026-10-01

Status: CLOSED — verified by GitHub Actions run #941 on branch head.

## 1. Explore
Phase 33 established the operational admin dashboard, but the management routes were still mostly form-plus-table surfaces. Classes lacked relationship summaries and deliberate discovery controls; teachers and users needed better search/filter workflows; academic years had limited management filtering; and students had no dedicated admin workspace.

## 2. Research
Research was intentionally broader than Figma.

### Institutional administration
- openSIS Staff Records: https://help.opensis.com/portal/en/kb/articles/staff-information-terms
- openSIS Course Sections: https://help.opensis.com/portal/en/kb/articles/course-sections
- openSIS Course Manager: https://help.opensis.com/portal/en/kb/articles/view-courses-in-course-manager-teacher-portal
- openSIS role-based portals: https://help.opensis.com/portal/en/kb/articles/portals
Useful patterns were role-specific access, teacher-to-section assignments, search/filter controls, visibility into assigned teachers and enrolled students, and active/inactive lifecycle management.

### React/data tables
- shadcn/ui Data Table: https://ui.shadcn.com/docs/components/base/data-table
- shadcn/ui ARIA Data Table: https://ui.shadcn.com/docs/components/aria/data-table
SAMS follows the compositional pattern: table rendering, toolbar controls, state, and row actions remain separate concerns. No TanStack runtime dependency was added because current administrative collections are bounded and existing SAMS table primitives already cover rendering.

### Accessibility
- WAI-ARIA overview: https://www.w3.org/WAI/standards-guidelines/aria/
Search/filter controls use labeled native form controls, tables remain semantic, and existing SAMS focus/target and async-state conventions remain in force.
Figma remains visual reference only. Existing SAMS schema, routing, security boundaries, and tests are authoritative.

## 3. Decide
Admin management is treated as connected workspaces:
- Classes ↔ Students
- Classes ↔ Teachers ↔ Subjects
- Users ↔ Account lifecycle
- Academic Years ↔ Classes
- Assignments ↔ Class access

Authority decisions:
- teacher_teachings remains the assignment authority.
- teacher_classes remains a derived compatibility/access table during migration.
- student management uses the existing legacy /api/students.php?class_id=ID contract because a canonical v1 student resource is not yet mounted.
- StudentTransferService remains authoritative for transfer integrity, enrollment history, attendance guards, same-school/same-year rules, transactions, and audit logging.
- No speculative student endpoint or schema migration was introduced.
- Class relationship counts are derived from current enrollment and active teacher users.
- Search/filter/sort runs client-side over the existing bounded list contracts; mutations remain server-authoritative.

## 4. Construct
Added shared admin workspace toolbar and its unit test.
Classes now support search, status/year filters, deterministic sorting, student/teacher relationship counts, and direct roster navigation with class_id in URL state.
Teachers now support search, active/inactive and online/offline filters, teacher sorting, assignment search, and assignment sorting.
Users now support search, role/status filters, and sorting by name, role, status, or activity.
Academic years now support status filtering and sorting.
Students now have an admin-only roster workspace with class context, search/filter/sort, create/edit, deactivate, and transfer controls.
Phase 34 also extends the admin shell People grouping to include Students.

## 5. Schema correction
The fresh database/schema.sql does not contain teacher_teachings.status; that column is introduced by migration 006. The admin class relationship-count query therefore does not depend on that migration-only column. This keeps the new query compatible with the repository's current fresh-install schema without introducing a new migration.

## 6. Tests
Updated administration integration to verify class relationship counts.
Extended Phase 14 E2E with the admin student roster lifecycle and aligned class fixtures with the new relationship fields.
Added AdminWorkspaceToolbar unit coverage for accessible search/filter semantics.

## 7. Verification
GitHub Actions run #941 verified the branch head with all seven required gates green: frontend-build, javascript, php, e2e, clean-school-acceptance, apache, and production-integration.
The admin student lifecycle regression passed inside the Playwright E2E gate, and the administration backend integration passed inside the PHP gate.

## 8. Git
Branch: `reconstruction/product-system-2026-10-01`
Verified head: `d6d43201c768924f0dac08336369e7561099369b`
CI verification: GitHub Actions run `#941`
Main base: `64a081294f7ec08612c85007d671aeb13f49c4c6`
No merge to main is performed in this phase.

## 9. Close criteria
All close criteria are satisfied:
- final branch-head CI is green;
- the admin student lifecycle regression passes;
- schema/API authority decisions remain intact;
- final documentation records the verified branch head and CI run;
- Phase 35 is the next planned phase; it has not started.

Phase 34 is formally closed. Phase 35 starts only from this verified branch state.