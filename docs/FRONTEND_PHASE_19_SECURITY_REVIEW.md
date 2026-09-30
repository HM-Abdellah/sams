# SAMS — Frontend Phase 19 — Security Review

Status: PASS — 2026-09-29

## Objective

Run an adversarial security review of the reconstructed frontend after Phase 18, focusing on browser-side attack surface and transport behavior.

The phase does not replace backend authorization, tenant isolation, validation, or server-side security. The backend remains the security authority.

## ECC attack-surface inventory

Reviewed:

- authentication/session provider and auth API;
- CSRF token lifecycle and mutation transport;
- protected/public route boundaries;
- post-login return navigation;
- API URL construction and query encoding;
- storage usage;
- DOM/HTML execution sinks;
- user/API-controlled data rendering;
- import file transport;
- signature data handling;
- dependency/security audit;
- production build surface.
## Findings

### Finding 1 — return-path validation allowed protocol-relative destinations

RED: LoginPage previously accepted any string beginning with /. A value beginning with // is a protocol-relative URL and can resolve to another origin.

Fix:

- added frontend/src/routes/safeReturnTo.ts;
- return navigation accepts only internal path/query/hash values;
- rejects protocol-relative paths;
- rejects absolute external URLs;
- rejects javascript-style schemes and backslash-based external forms;
- confirms the resolved URL origin matches the current origin.

This is a client-side defense against open-redirect behavior. It does not replace server-side redirect validation where redirects exist.

### Finding 2 — no executable HTML sinks found

Static scan found no occurrences of:

- dangerouslySetInnerHTML;
- innerHTML;
- eval;
- new Function;
- window.open;
- postMessage.

React-controlled rendering is used for API-derived names, labels, metadata and other display values.
### Finding 3 — CSRF transport reviewed and adversarially tested

Protected mutations use the shared CSRF token:

- token is captured from the session response;
- protected POST/DELETE requests require a token;
- the token is stored only in process memory;
- logout clears the token;
- unauthenticated session refresh clears the token.

Public onboarding request/activation endpoints intentionally omit CSRF because the frozen backend contract marks them as public flows. This exception was tested explicitly.

### Finding 4 — role boundary reviewed

Route groups are protected by ProtectedRoute and RoleRoute.

Teacher navigation routes are limited to the teacher role.
Admin navigation/routes are limited to the admin role.
Unknown/unrecognized roles do not receive either role-specific route group.

A dedicated adversarial E2E verifies a teacher cannot enter /app/admin/users.
### Finding 5 — credential persistence reviewed

No localStorage/sessionStorage usage exists in the frontend source.

Session credentials are expected to remain server-managed through the browser session/cookie model. The frontend does not copy passwords or session credentials into web storage.

### Finding 6 — untrusted display data is rendered as text

An adversarial E2E injects an HTML payload through a class name and verifies:

- the payload is visible as text;
- no injected image element is created;
- the injected event does not execute.

Import values, student names, teacher names and other API-controlled strings follow the same React text-rendering path.

## Dependency and build review

### Dependency audit

npm audit --audit-level=high returned:

0 vulnerabilities.

The accessibility test dependency added in Phase 18 is @axe-core/playwright 4.13.0.

### Production build

Vite production build: PASS.
The generated production bundle contains no sourceMappingURL markers.

### Secret/config scan

Reviewed the frontend environment surface.

Only frontend/.env.example exists in the frontend tree and contains a same-origin API path plus a localhost development example. No credential or private-key patterns were found in source or production build output.

## Security verification

Dedicated Phase 19 E2E:

- 6/6 PASS.

Coverage:

- same-origin return-path validation;
- XSS payload rendering;
- protected CSRF header propagation;
- public onboarding CSRF omission;
- teacher/admin route boundary;
- no credential persistence in web storage.

Combined frontend regression:

- Phases 12–19: 42/42 PASS.
Static gates:

- TypeScript: PASS;
- Oxlint: 0 warnings / 0 errors;
- Vite production build: PASS;
- npm audit: 0 vulnerabilities;
- secret pattern scan: clean;
- HTML/JS execution sink scan: clean;
- source-map scan: clean;
- git diff --check: PASS.

## Security boundaries and limitations

The frontend role guard is defense-in-depth and user-experience protection. It cannot be treated as the authorization authority.

Server-side enforcement must continue to protect:

- authentication;
- authorization;
- tenant boundaries;
- CSRF validation;
- object ownership;
- import validation;
- data validation;
- session invalidation.

No backend behavior was changed by this phase because no proven backend security gap was required to close a frontend finding.

## Gate

PASS.

Current project state: Official frontend Phases 1–19 are PASS. Phase 20 — Frontend Performance is next.
