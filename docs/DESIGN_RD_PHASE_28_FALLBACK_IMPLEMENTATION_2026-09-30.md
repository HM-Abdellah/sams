# SAMS — Phase 28 Fallback Implementation Evidence

Date: 2026-09-30

## Scope

Figma construction remains blocked by the active Starter-plan MCP tool-call rate limit. Phase 28 therefore continues through the documented fallback path: current design research → SAMS-specific interaction decision → production implementation of the already-approved reference behavior → verification.

This is not a claim that the Figma file was constructed or visually verified.

## Research evidence used

- shadcn/ui currently documents Radio Group as a single-choice semantic primitive and explicitly includes disabled and RTL examples. The implementation keeps the production baseline on native `<select>` while the direct-radio pattern remains a prototype candidate.
- 21st.dev's current dashboard guidance separates table/data behavior from visual styling and recommends treating community components as source material whose quality and state ownership must be inspected before adoption.
- Lightswind currently exposes responsive React/Tailwind data-admin patterns, including tables, audit interfaces, and filtering-oriented admin blocks. These were used for pattern comparison rather than copied as product UI.

## Production change

`frontend/src/pages/app/TeacherAttendancePage.tsx`

Implemented from the Phase 28 decision record:

1. Period navigation now uses a horizontal rail on narrow screens instead of the former 2 × 4 grid.
2. Desktop progressively upgrades the same rail into 4 columns at `md` and 8 columns at `xl`, avoiding unnecessary horizontal scrolling when the viewport can carry all periods.
3. Student names use an explicit `dir="auto"` span so mixed Arabic/Latin names have a deterministic bidi boundary without changing the surrounding layout direction.
4. The production attendance status interaction remains the semantic native select baseline. The direct radio interaction is still isolated to `docs/prototypes/phase28-attendance.html` until task-level usability validation justifies replacing the baseline.

## Verification

Executed in `/workspaces/sams/frontend` after the change:

- `npm run typecheck` — PASS
- `npm run lint` — PASS (0 warnings, 0 errors)
- `npm run test:unit` — PASS (10 test files, 45 tests)
- `npm run build` — PASS (Vite production build)
- `git diff --check` — PASS

An attempted `npm run test:unit -- --runInBand` is intentionally not counted as a failure of the implementation: Vitest 5 rejects `--runInBand` as an unknown option. The correct `npm run test:unit` command was then executed successfully.

## Gate status

- Phase 28 design specification gate: PASS
- Phase 28 interaction gate: PASS
- Phase 28 fallback production-reference implementation: PASS for the approved rail/bidi subset above
- Figma construction gate: BLOCKED by external Starter-plan MCP rate limiting
- Direct-radio production replacement: NOT APPROVED; requires task-level usability validation across FR/EN/AR, touch, keyboard, and protected lessons

## Research rule

The fallback is intentionally not a clone of another site's UI. External sources are used to extract interaction patterns, density rules, responsive behavior, accessibility semantics, and component composition; SAMS tokens, routing, data flow, save semantics, and attendance-domain constraints remain authoritative.

### Follow-up refinement

The period and day rail items retain `shrink-0` on the production buttons so the horizontal rail preserves stable control geometry on narrow screens rather than letting flexbox compress frequent touch targets. The responsive E2E test now asserts the period controls by accessible button names instead of depending on the old 2 × 4 CSS grid.

## AppShell refinement — fallback construction

Research evidence reinforced a layout rule that is useful to SAMS: authenticated application navigation should be structurally separated from task content, while RTL positioning should use logical start/end relationships. shadcn/ui's current RTL guidance documents this approach for Sidebar/navigation components. The SAMS implementation adapts that principle without importing the library's architecture.

Production change in `frontend/src/components/layout/AppShell.tsx`:

1. Desktop (`md+`) uses a persistent role-aware navigation rail beside the task content.
2. Mobile retains a horizontal overflow-safe navigation rail so the existing 320px responsive behavior remains usable.
3. Active navigation is communicated through weight, surface, and a logical start-border rather than color alone.
4. The shell uses `min-w-0` on the grid/navigation container so the horizontal mobile nav becomes the scroll container instead of expanding the page.
5. Header, navigation, and content now consistently consume SAMS semantic tokens for background, surface, text, muted text, border, and focus.

Verification for this refinement:

- Phase 17 responsive E2E: 4/4 passed.
- Phase 18 accessibility E2E: 7/7 passed.
- Combined regression suite: 11/11 passed.
- Unit tests: 45/45 passed.
- Typecheck: PASS.
- Lint: PASS, 0 warnings / 0 errors.
- Production build: PASS.
- Visual geometry smoke: 390px LTR/RTL and 1440px LTR/RTL all stayed within viewport width; desktop navigation moved to the RTL side correctly.

This is a fallback implementation of the design-system direction. It does not claim Figma structural construction, screenshot verification, or component-library instance binding.

## Token audit follow-up — signature canvas

The signature canvas previously used literal #171717 and #ffffff rendering values. The rendering layer now reads the SAMS semantic text/surface tokens at runtime, while the canvas element itself uses the same surface token for its background.

Verification:

- Typecheck: PASS.
- Lint: PASS, 0 warnings / 0 errors.
- Teacher signatures E2E: 1/1 passed.
- Production build: PASS.

This keeps the implementation aligned with the design-token foundation without changing signature storage, API behavior, or the interaction model.
