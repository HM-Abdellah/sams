Exit criteria: installability and offline sync pass where supported without regressions to online mode.

## Phase execution rule
Every phase follows: Explore → Research → Decide → Construct → Verify → Document → Git-check → Close.

Every phase records: goal, evidence, files changed, technical decisions, tests, visual QA, security impact, known limitations, exit status.

## Priority order
Correctness → Data integrity → Security → Core workflow → Responsive usability → Accessibility → Performance → Visual polish.

## Current position
Phase 37 — Teacher Attendance Responsive Reconstruction is closed on the reconstruction branch.
Phase 38 — Shared Attendance + Concurrency is also closed and merged.
Phase 39 — Data + Analytics + Reporting Consistency is closed on its isolated reconstruction branch.
Phase 30 baseline reconciliation, Phase 31 shared design-system/responsive foundation, Phase 32 application shell + information architecture, Phase 33 Admin Dashboard Reconstruction, Phase 34 Admin Management Workspaces, Phase 35 Admin Operations + Data Workspaces, Phase 36 Teacher Home + My Classes + Class Workspace, Phase 37 Teacher Attendance Responsive Reconstruction, and Phase 38 Shared Attendance + Concurrency are closed.
Phase 34 verification is complete on exact implementation head `23d727495bd6eba01542a808310934bfd59e1b45`; GitHub Actions run #944 passed all seven required gates.
Phase 35 implementation verification is complete on exact implementation head `300e28a67e1d015eb88766ccb1089b9286d6fbac`; GitHub Actions run #974 passed all seven required gates.
Phase 36 final verification is complete on exact verification head `bf0592d164b42393ec785d82ad74227427290a07`; GitHub Actions run #979 passed all seven required gates.
Phase 37 final implementation head is `f2c421bc195fda93215be3ba32562fad5b41aa66`; GitHub Actions run #981 passed all seven required gates after a retry of the transient frontend dependency-audit failure.
Phase 39 implementation head is `3768197202f57281afb16eb21a0dbc1e5a725b6c`; GitHub Actions verification run #8 passed both Backend and Frontend jobs. The working branch `reconstruction/phase-39-data-analytics-reporting-2026-10-02` is ready for merge into `reconstruction/product-system-2026-10-01`.

## Current status
Phase 39 is CLOSED after dedicated Backend + Frontend CI verification.
Phase 38 introduced server-authoritative shared attendance revisions and concurrency conflict handling; its PR is merged.
Phase 39 is standardizing attendance metric semantics across the admin dashboard, teacher reports, and historical archive so the same persisted-data denominator and null/no-data behavior are used everywhere.
No timetable, alerts, calendar, expected-session completeness metric, or export contract is being invented where no dedicated backend contract exists; those remain future scope.
Demo stability remains the primary acceptance constraint, with data correctness and security ahead of visual polish.

