Exit criteria: installability and offline sync pass where supported without regressions to online mode.

## Phase execution rule
Every phase follows: Explore → Research → Decide → Construct → Verify → Document → Git-check → Close.

Every phase records: goal, evidence, files changed, technical decisions, tests, visual QA, security impact, known limitations, exit status.

## Priority order
Correctness → Data integrity → Security → Core workflow → Responsive usability → Accessibility → Performance → Visual polish.

## Current position
Phase 37 — Teacher Attendance Responsive Reconstruction is closed on the reconstruction branch.
Phase 30 baseline reconciliation, Phase 31 shared design-system/responsive foundation, Phase 32 application shell + information architecture, Phase 33 Admin Dashboard Reconstruction, Phase 34 Admin Management Workspaces, Phase 35 Admin Operations + Data Workspaces, Phase 36 Teacher Home + My Classes + Class Workspace, and Phase 37 Teacher Attendance Responsive Reconstruction are closed.
Phase 34 verification is complete on exact implementation head `23d727495bd6eba01542a808310934bfd59e1b45`; GitHub Actions run #944 passed all seven required gates.
Phase 35 implementation verification is complete on exact implementation head `300e28a67e1d015eb88766ccb1089b9286d6fbac`; GitHub Actions run #974 passed all seven required gates.
Phase 36 final verification is complete on exact verification head `bf0592d164b42393ec785d82ad74227427290a07`; GitHub Actions run #979 passed all seven required gates.
Phase 37 final implementation head is `f2c421bc195fda93215be3ba32562fad5b41aa66`; GitHub Actions run #981 passed all seven required gates after a retry of the transient frontend dependency-audit failure.
The working branch remains isolated from main: reconstruction/product-system-2026-10-01.

## Current status
Phase 37 is CLOSED.
The teacher attendance workspace now uses a dedicated single-period mobile roster while preserving the existing desktop register and server-authoritative attendance write flow.
No timetable, alerts, calendar, or recent-activity data was invented where no dedicated backend contract exists; those remain future scope.
The next reconstruction slice should be selected from the remaining prioritized product backlog with demo stability continuing as the primary acceptance constraint.

