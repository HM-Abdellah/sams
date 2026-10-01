# SAMS — Product Reconstruction Phase 33
## Admin Dashboard Reconstruction
### 2026-10-01

Status: **Implementation complete; verification pending external CI/Codespace recovery.**

## 1. Explore

The pre-phase Admin dashboard already exposed active classes, students, teachers, today's presence rate, today's records, class statistics, high-absence students, missing-class detection, and recent audit activity.

Phase 30 identified the main product gaps: online teachers were visible only as a count; active academic-year context was absent; no attendance trend existed; operational attention areas were mixed into a generic page; and there was no deliberate quick-action hierarchy.

The existing SAMS backend/schema was treated as authoritative. Attendance still has no subject_id, so this phase does not fabricate subject context.

## 2. Research

Research was intentionally broader than Figma.

### School administration / product references

- openSIS Administrator Dashboard Overview: https://help.opensis.com/portal/en/kb/articles/administrator-dashboard-overview
- openSIS Administrator Dashboard concepts: https://help.opensis.com/portal/en/kb/articles/understanding-the-administrator-dashboard
- openSIS navigation: https://help.opensis.com/portal/en/kb/articles/understanding-opensis-navigation
- PowerSchool Dashboards: https://ps.powerschool-docs.com/pssis-admin/latest/dashboards
- PowerSchool Attendance Overview: https://uc.powerschool-docs.com/unified-insights/latest/attendance-overview
- SchoolHub attendance dashboard reference: https://schoolhub.tech/school-attendance-system

Recurring useful patterns were: clear academic context, KPI summaries, attendance distribution, time trends, missing/incomplete records, high-absence attention, teacher presence visibility, and drill-down links to operational workspaces.

### UI / composition references

- 21st.dev dashboard components: https://21st.dev/blog/dashboard-component-libraries
- 21st.dev React dashboards: https://21st.dev/blog/react-dashboard-components
- shadcn/ui: https://ui.shadcn.com/
- Refero: https://refero.design/
- styles.refero.design: https://styles.refero.design/
- Lightswind: https://www.lightswind.com/blocks/navigation
- React Bits: https://pro.reactbits.dev/docs/blocks/navigation

### Accessibility references

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- W3C complex images / charts guidance: https://www.w3.org/WAI/tutorials/images/complex/
- WAI-ARIA APG: https://www.w3.org/WAI/ARIA/apg/

Figma remains a visual reference only. Product behavior is decided from research plus the existing SAMS API, database, security rules, tests, and real workflows.

## 3. Decide

Dashboard hierarchy:

Context → KPIs → Attendance Today → Trend → Needs Attention → Teachers Online → Classes → Quick Actions

Data decisions:
- active academic year is loaded from the current school-scoped year
- attendance trend covers 14 calendar days
- days with no records stay null rather than becoming false 0% attendance
- online teachers use the existing 90-second last-seen rule
- the existing /admin/dashboard endpoint remains the canonical transport
- no chart package was added; the trend uses inline SVG
- class presence rate is calculated from recorded rows only
- quick actions point only to existing admin routes
- no admin Students route was invented
- no attendance subject field was invented

Accessibility decisions:
- status counts accompany the color distribution
- the trend has SVG title/description plus textual data
- class statistics remain a semantic HTML table
- responsive layouts use the existing shared target/focus conventions

## 4. Construct

Backend changes:
- backend/src/Repositories/AdminDashboardRepository.php: activeAcademicYear(), attendanceTrend(), onlineTeachers()
- backend/src/Services/AdminDashboardService.php: exposes academic_year, attendance_trend, online_teachers

Frontend changes:
- frontend/src/features/admin/types.ts
- frontend/src/pages/app/AdminDashboardPage.tsx
- frontend/src/features/i18n/types.ts
- frontend/src/features/i18n/dictionary.ts

The UI now contains the academic context, KPI grid, today's status distribution, 14-day trend, needs-attention panels, online teacher identities, class metrics, and quick actions.

Test coverage changes:
- tests/administration_backend_integration.php validates the new dashboard contract
- tests/e2e/frontend_phase14_admin_platform.spec.js uses the expanded dashboard fixture and checks new operational sections
- frontend/src/pages/app/AdminDashboardPage.test.tsx covers rendering from the canonical snapshot

## 5. Verification

Verified by repository inspection:
- GET /admin/dashboard remains the dashboard endpoint
- admin authorization remains enforced by the controller
- tenant scoping still derives from authenticated school_id
- new queries use the current schema and existing indexes
- no new frontend runtime dependency was introduced
- no speculative route or attendance subject context was added

Execution is pending because the connected Codespace device became unavailable during the phase.

Not yet claimed as executed locally:
- frontend typecheck
- Oxlint
- Vitest
- Vite production build
- PHP syntax checks
- administration backend integration
- Playwright E2E

Independent CI verification is being requested through draft PR #31:
https://github.com/HM-Abdellah/sams/pull/31

No merge to main has been performed.

## 6. Git-check

All phase writes target reconstruction/product-system-2026-10-01.

Final branch cleanliness and local git diff --check require Codespace recovery or CI evidence.

## 7. Close criteria

Phase 33 is closed only after CI completes, failures are investigated if present, the Codespace is synchronized when available, final git state is verified, and the roadmap advances to Phase 34.
