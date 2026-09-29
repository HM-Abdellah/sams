# SAMS — Frontend Phase 8 — Internationalization and RTL Foundation

Status: PASS — 2026-09-29

## Scope

Phase 8 establishes the runtime language, direction, and locale-formatting foundation required by the frontend architecture.
The implementation supports French, Arabic, and English without maintaining separate component implementations.

## Implemented

- typed supported locales: fr, ar, en;
- semantic translation keys;
- typed translation dictionaries for the current shared/auth/navigation surface;
- runtime language switching;
- runtime document language and direction updates;
- RTL mode through document.dir rather than duplicated components;
- locale-aware date formatting;
- locale-aware number formatting;
- Morocco-aware Intl locales: fr-MA, ar-MA, en-GB;
- shared LanguageSelect available on public login and authenticated shell.

## Architecture

Translation ownership is separated from feature/business logic:

Language provider → typed i18n context → semantic translation dictionary

Feature/page code requests semantic keys and does not contain language-specific branching.

Route definitions now carry translation keys rather than rendered labels.

## RTL contract

Arabic switches document direction to rtl. French and English use ltr.
Shared components continue to use direction-neutral layout primitives and do not introduce Arabic-only component variants.

## State and persistence

Language is intentionally held in runtime React state for this phase.
No localStorage, sessionStorage, cookies, or server-side preference mutation were introduced.
This avoids creating a second persistence contract before product requirements for preference persistence are defined.

## Formatting contract

Date and number formatting are exposed through the i18n context rather than scattered Intl calls across pages.
Date input parsing remains a feature responsibility; the i18n layer formats already-valid values.

## Integration

The following production-facing surfaces now consume the i18n foundation:

- AppShell navigation and sign-out;
- Login page labels, hints, loading state, and fallback error;
- language selection on Login and authenticated shell.

Backend errors remain server-derived when an ApiError is available. The client does not replace authoritative backend error meaning with guessed translations.

## Verification

- TypeScript typecheck: PASS
- Oxlint: PASS — 0 warnings / 0 errors
- Vite production build: PASS
- HTTP route probe: PASS — temporary i18n route returned HTTP 200
- Playwright browser smoke: PASS
- French translation + ltr metadata: PASS
- Arabic translation + rtl metadata: PASS
- runtime language switch back to English + ltr: PASS
- locale-aware date formatting changed across fr/ar: PASS

A dedicated temporary browser route was used to isolate the i18n contract from unavailable authenticated backend state in the local Codespace environment. The temporary route was removed after verification.

## Phase gate

PASS.

Phase 8 provides the runtime FR/AR/EN and RTL foundation while keeping visual identity, page composition, and feature business logic independent.

📍 Project position: Frontend engineering 8/24 complete; backend/security/auth/tenant foundation remains frozen and verified.
