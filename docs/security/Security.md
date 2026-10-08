# SAMS Security Policy

Status: Normative
Version: 2026-10-06
Scope: Production-oriented SAMS application, repository, deployment, and operational practices.

## 1. Purpose

This document is the top-level security policy for SAMS.

It defines mandatory engineering rules for:
- authentication and authorization;
- API and browser security;
- school/tenant isolation;
- data protection;
- secrets and configuration;
- dependency and supply-chain hygiene;
- logging and auditability;
- secure deployment and operations;
- security verification.

This document is normative. When implementation conflicts with this document, the implementation is not considered complete until the conflict is consciously reviewed and this document or the implementation is corrected.

## 2. Normative language

- MUST / MUST NOT: mandatory.
- SHOULD / SHOULD NOT: strong default; deviations require a documented reason.
- MAY: optional when justified.

## 3. SAMS security principles

1. **Server is authoritative.** Browser controls are UX/defense-in-depth only. Authentication, authorization, tenant scope, validation, and integrity are enforced on the server.
2. **Deny by default.** Every protected capability requires an explicit server-side authorization path.
3. **Least privilege.** Users, database accounts, application components, and operators receive only required access.
4. **Tenant isolation.** Every authenticated school-scoped read and mutation is evaluated against the actor's school scope.
5. **Secure by construction.** Security controls are designed into features rather than added after implementation.
6. **Secrets stay out of source control.** Passwords, database credentials, private keys, tokens, and production secrets MUST NOT be committed.
7. **Fail closed.** Security failures MUST deny the sensitive operation rather than silently continue.
8. **No sensitive error leakage.** Production responses MUST be generic; details belong in controlled server-side logs.
9. **Audit important mutations.** Privileged and security-sensitive actions MUST be auditable.
10. **Preserve history.** School records, attendance history, and audit evidence MUST NOT be casually destroyed by normal workflows.
11. **Recovery is part of security.** Account recovery, backup, restore, and incident response are release requirements, not optional operations.
12. **Evidence over assumption.** A security claim is valid only when supported by code inspection, test evidence, runtime evidence, or documented operational evidence.

## 4. Current SAMS architecture anchors

The security policy is designed around the current repository architecture:

- React + TypeScript + Vite + Tailwind frontend.
- PHP 8.3 backend.
- MySQL/MariaDB.
- Same-origin canonical REST/JSON API under `/api/v1`.
- Server-managed PHP session.
- School tenant rooted at `schools`.
- Role model currently includes `admin`, `teacher`, and `counselor`.
- Repository layer owns SQL.
- Service layer owns business rules and transaction orchestration.
- Controllers translate HTTP requests/responses and enforce entry-point security.

Existing controls that MUST be preserved include CSRF protection on protected state-changing canonical routes, login throttling/lockout, session-version invalidation, prepared PDO behavior, request-size limits, transactional mutations, audit logging, and generic production errors.

## 5. Security control catalog

SAMS treats the following controls as permanent security obligations:

1. Secrets/API keys are never exposed to the client or committed.
2. Environment/configuration is validated and production defaults fail closed.
3. Admin routes and functions are server-side protected.
4. Authentication and session lifecycle are correctly implemented.
5. Authorization is checked for the requested function and resource.
6. Inputs are normalized and validated server-side.
7. Output is rendered safely and XSS defenses are maintained.
8. Abuse-sensitive endpoints are rate-limited/throttled.
9. API endpoints follow the canonical security contract.
10. CORS is explicitly controlled; same-origin deployment does not gain permissive cross-origin access by default.
11. Security response headers are present and tested.
12. Production debug behavior is disabled and safe errors are returned.
13. Dependencies are kept patched and audited.
14. Unused dependencies are removed after dependency-graph verification.
15. Sensitive files are not web-exposed.
16. Database access is least-privileged and parameterized.
17. Passwords are stored using a password hashing function and never plaintext.
18. Git history/worktree are checked for secrets.
19. A full security audit is run before major production releases and after material security changes.

## 6. Input, output, and API rules

- Every server endpoint MUST validate HTTP method, authentication state where required, authorization scope, content type, request size, and field semantics.
- Validation MUST happen server-side even when the browser validates the same field.
- Prefer allowlists and semantic validation over malicious-string blacklists.
- SQL MUST use parameterized queries/prepared statements.
- User/API-controlled strings MUST be safely rendered; do not introduce executable HTML sinks without a documented security review.
- Unexpected fields SHOULD be rejected for security-sensitive payloads where practical.
- JSON/body limits MUST be enforced before expensive parsing or processing.
- Import endpoints MUST retain file-size, row-count, parser, and transaction limits.

## 7. Authentication and authorization rules

- Public administrator registration is forbidden.
- Admin creation is an authenticated administrator capability.
- Teachers use the approved onboarding workflow; onboarding does not itself grant operational access.
- Users MUST NOT self-select privileged roles.
- Role and school scope MUST be derived and enforced server-side.
- Sensitive account changes MUST invalidate affected sessions through the established session-version mechanism or an explicitly stronger mechanism.
- Password recovery MUST NOT reveal whether an account exists to an unauthenticated requester.
- Recovery credentials/tokens MUST be random, short-lived, single-use, and rate-limited.
- Admin-assisted recovery MUST allow an administrator to initiate a reset without learning the user's new password.

## 8. Session rules

Current SAMS uses secure PHP cookie sessions with:
- HttpOnly;
- SameSite=Lax;
- Secure when HTTPS is active;
- strict session mode;
- idle timeout;
- absolute timeout;
- session identifier regeneration;
- session-version invalidation.

These controls MUST remain consistent between development, test, and production behavior, with stronger production transport requirements.

## 9. Browser and transport rules

- Production traffic MUST use HTTPS.
- HSTS MUST only be enabled when HTTPS is known to be correct for the deployed hostname/domain.
- CORS MUST remain closed by default in the same-origin deployment model.
- CSP and other security headers MUST be tested against the built application before enforcement is tightened.
- `X-XSS-Protection` MUST NOT be used as a primary XSS defense.
- Sensitive cookies MUST use secure attributes.

## 10. Configuration and secrets

- Frontend variables are public configuration once bundled; never place secrets in `VITE_*` values.
- Production credentials belong in runtime/server-side configuration or a suitable secret-management mechanism.
- Local config files containing credentials MUST be ignored by Git.
- Debug mode MUST be disabled in production.
- Production configuration MUST fail closed when required secrets or security-critical settings are missing.
- Secret values MUST never be printed to logs, errors, screenshots, or audit records.

## 11. Database and data protection

- The application MUST use a least-privileged database account in production.
- Database access SHOULD be restricted to the application host/network.
- Development, test, and production data stores MUST be separated.
- Real school/student data MUST NOT be used in repository fixtures or casual development.
- Historical attendance and audit records MUST retain their school/year context.
- Normal UI workflows SHOULD archive/deactivate rather than hard-delete historically significant records.
- Backups MUST be protected and stored outside the Git repository.

## 12. Logging and audit

Security and operationally important events SHOULD include:
- login success/failure;
- logout;
- password reset/recovery actions;
- SAMS Code issue/reissue;
- account activation, suspension, deactivation;
- admin creation;
- onboarding issue/request/approval/rejection/activation;
- privileged data mutations;
- academic-year lifecycle changes;
- import commit/rollback;
- security incidents.

Logs MUST NOT contain passwords, session cookies, reset tokens, database credentials, or other reusable secrets.

## 13. Dependency and supply-chain rules

- Run Composer and npm security audits regularly and before production releases.
- Keep supported runtime versions patched.
- Remove unused direct dependencies after verifying the dependency graph.
- Do not add a dependency merely to solve a problem that can be solved safely with existing project patterns.
- A dependency update is incomplete until the relevant tests and build are green.

## 14. File and deployment exposure

Sensitive files MUST NOT be publicly readable, including:
- environment files;
- local database/config files;
- Git metadata;
- database dumps;
- logs;
- private storage;
- temporary artifacts;
- test-only data.

The application document root MUST expose only intended web assets and the canonical public entry point.

## 15. Change security gate

Any change affecting authentication, authorization, school scope, database schema, attendance integrity, imports, file handling, recovery, deployment, or privileged UI MUST follow:

`Inspect → Understand → Plan → RED → Implement → GREEN → Refactor → Review → Verify`

A security-sensitive change is not complete until:
- the relevant threat is considered;
- the security checklist is updated/verified;
- focused tests pass;
- the changed diff is reviewed;
- no secrets or debug artifacts were introduced.

## 16. Ownership

The SAMS technical operator is responsible for:
- maintaining the security policy;
- keeping production configuration secure;
- backup/recovery readiness;
- incident handling;
- release verification;
- operational access hygiene.

School administrators are responsible for ordinary business administration within their granted role.

## 17. Related documents

- `Auth.md`
- `Data security.md`
- `Threat Model.md`
- `Security Checklist.md`
- `Disaster Recovery.md`
- `Incident Response.md`
- `Operations Runbook.md`

## 18. References

- OWASP ASVS 5: https://cornucopia.owasp.org/taxonomy/asvs-5.0/
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP Forgot Password Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- OWASP REST Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- OWASP HTTP Headers Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
- OWASP Threat Modeling Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html
- OWASP Database Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- NIST CSF 2.0: https://www.nist.gov/cyberframework
- NIST SP 800-63B-4: https://pages.nist.gov/800-63-4/sp800-63b.html
- NIST SP 800-61r3: https://csrc.nist.gov/pubs/sp/800/61/r3/final
- GitHub secret push protection: https://docs.github.com/en/code-security/concepts/secret-security/push-protection

