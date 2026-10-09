# SAMS Authentication, Identity & Account Lifecycle Policy

Status: Normative
Version: 2026-10-06

## 1. Scope

This document defines how SAMS identifies users, authenticates them, grants role-based access, manages sessions, handles onboarding, and recovers accounts.

The backend is the authority. Frontend route guards and UI states are defense-in-depth only.

## 2. Identity model

- `users.id` is the immutable internal identity and historical foreign-key target.
- `users.school_id` binds the user to exactly one school tenant.
- The current canonical teacher login identifier is the reissuable SAMS Code.
- SAMS Code is not a password and not a database ID.
- SAMS Codes are stored as SHA-256 hashes; plaintext is only available at explicit issuance/reissue time.
- The current backend also retains username compatibility for administrative accounts.
- Account recovery MUST keep the same `users.id`; recovery MUST NOT create duplicate identities.

## 3. Roles

Current roles:
- `admin`
- `teacher`
- `counselor`

Rules:
- Users MUST NOT choose their own role during public onboarding.
- Role assignment is a server-side business rule.
- Administrative functions MUST use server-side role checks.
- Unknown roles receive no privileged capability.
- Role checks are necessary but may be insufficient: resource ownership, school scope, assignment, and business rules must also be evaluated.

## 4. Administrator lifecycle

### Bootstrap administrator

The first administrator is provisioned outside the public UI using the controlled bootstrap process.

Current script:
`php scripts/create_admin.php`

Requirements:
- It MUST NOT be exposed as a public route.
- It MUST create a secure password verifier, never store a plaintext password.
- The bootstrap process MUST require explicit operator action.
- Before real-school deployment, the script SHOULD accept operator-supplied username/full name/password/school instead of relying on hardcoded identity assumptions.

### Additional administrators

Only an authenticated, authorized administrator may create another administrator.

The UI should say:
- `Add Administrator` or `Create Administrator`

The form MUST NOT expose a free role selector.

The backend MUST set:
`role = admin`

Admin creation must be:
- authenticated;
- authorized;
- school-scoped;
- validated;
- CSRF-protected where applicable;
- transactional;
- audited.

## 5. Teacher onboarding

Current implemented lifecycle:

`school onboarding code → pending request → admin review → approval/rejection → teacher activation → active account → initial SAMS Code`

Important distinction:

- onboarding request ≠ user account;
- pending request ≠ operational access;
- onboarding code ≠ authentication credential;
- approval ≠ password knowledge.

Current `OnboardingService` controls:
- 12-character random school onboarding code;
- 7-day code expiration;
- request-token hashing;
- request expiration;
- rate limiting;
- pending/approved/rejected/expired states;
- admin review;
- account activation;
- audit events.

### Product direction

A future teacher-specific invitation/QR layer may improve UX by binding an invitation to a specific teacher. If introduced, it MUST preserve the same security lifecycle:

`admin-approved invitation context → teacher completes registration → activation → login`

A generic public teacher signup must remain disabled.

## 6. Authentication flow

Canonical React/API path:

`POST /api/v1/auth/login`

Current login behavior:
1. Session is initialized.
2. CSRF token is established.
3. Credentials are validated.
4. Failed authentication is throttled/locked.
5. Successful authentication rotates the session state.
6. The authenticated identity is stored server-side.
7. CSRF state is rotated.
8. The client receives non-secret identity/session data.

The login response MUST NOT expose:
- password hashes;
- SAMS Code hashes;
- database credentials;
- session internals.

## 7. Password policy

Passwords:
- MUST be stored with PHP password hashing APIs.
- MUST be verified with `password_verify`.
- MUST be rehashed when the configured password hashing parameters require it.
- MUST never be logged or returned by an API.
- MUST NOT be encrypted as a substitute for password hashing.

Current code uses `PASSWORD_DEFAULT`; changing to another password-hashing algorithm requires compatibility/performance verification before deployment.

SAMS follows the modern principle that strong length and compromise screening are more useful than arbitrary composition rules. Avoid unnecessary rules such as forced mixes of uppercase/symbols unless a concrete risk decision justifies them.

## 8. Session management

Current session controls:
- strict session mode;
- cookies only;
- no URL session IDs;
- HttpOnly;
- SameSite=Lax;
- Secure when HTTPS is active;
- idle timeout;
- absolute timeout;
- session-ID regeneration;
- session-version invalidation;
- inactive-account checks.

Rules:
- Authentication MUST establish a fresh session identity.
- Sensitive privilege/account changes MUST create a new effective session boundary.
- Logout MUST destroy the application session.
- Suspended/deactivated users MUST lose authenticated access.
- Session expiry MUST be enforced server-side.

## 9. Failed login and throttling

Current baseline:
- 5 failed attempts;
- 15-minute temporary lock by configuration;
- counters are updated inside a database transaction with row locking.

This is not a final universal abuse policy. Before production, review:
- account-based throttling;
- IP/network abuse;
- login endpoint resource limits;
- monitoring/alerting;
- recovery of legitimate users from lockout.

Lockout MUST NOT become a trivial denial-of-service tool against a known user account; throttling should be designed with abuse trade-offs in mind.

## 10. Password recovery

### Current baseline

The repository's current recovery primitive is:
- authenticated school-admin recovery/reset;
- session-version invalidation;
- SAMS Code reissue;
- no self-service email/SMS recovery yet.

Do not expose a `Forgot password` link that calls a nonexistent backend contract.

### Required future self-service flow

When implemented:

`Forgot password → generic response → verified recovery channel → single-use expiring reset token → new password → session revocation → normal login`

Requirements:
- generic response for existing/non-existing accounts;
- uniform-ish response timing where practical;
- cryptographically random reset tokens;
- secure storage of token verifiers;
- short expiration;
- single use;
- rate limiting;
- notification after recovery;
- no automatic privileged-session bypass;
- recovery MUST NOT reveal the user's password.

## 11. Administrator-assisted recovery

When a user cannot access self-service recovery:
1. Admin verifies the appropriate real-world identity/process.
2. Admin initiates reset.
3. System invalidates the required session boundary.
4. User sets a new password through the controlled recovery flow.
5. Recovery is audited.

The administrator MUST NOT learn or choose the user's final password.

For the administrator's own account, SAMS MUST have a documented privileged-recovery path that does not depend on the application already being able to authenticate that same account.

## 12. Account lifecycle

Current states:
- `active`
- `suspended`
- `deactivated`

State changes MUST:
- be authorized;
- be audited;
- invalidate active sessions when security requires;
- preserve historical identity and data references.

## 13. Recovery safety rules

Recovery must never:
- create a second user record for the same identity;
- grant a higher role;
- remove school scoping;
- bypass authorization;
- expose secrets in response bodies;
- silently restore a deactivated user without an explicit authorized workflow.

## 14. API authorization checklist

Every protected endpoint must answer:
- Who is the actor?
- Is the session valid?
- Is the actor's account active?
- What role/capability is required?
- What school does the actor belong to?
- Does the actor have access to this exact resource?
- Is the mutation allowed in the current business state?
- Is CSRF required?
- Should the action be audited?
- Does the operation require a transaction or concurrency check?

## 15. Auth UI rules

The login UI MUST remain intentionally simple.

Required:
- normal login;
- password visibility control;
- safe authentication errors;
- onboarding entry for users with a school onboarding mechanism;
- recovery entry only when its backend contract exists.

Do not add:
- public role selection;
- public administrator registration;
- social login;
- security questions;
- `Remember me` until session policy explicitly supports it;
- MFA UI until the full MFA lifecycle and recovery design exists.

## 16. Tests

Authentication changes require, where applicable:
- successful login;
- wrong credentials;
- lockout/throttling;
- inactive account;
- session expiry;
- session-version invalidation;
- logout;
- role boundary;
- school boundary;
- CSRF boundary;
- onboarding request;
- approval/rejection;
- activation;
- duplicate activation;
- recovery/reset;
- secret/non-disclosure assertions.

## 17. References

- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP Forgot Password Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP ASVS 5 Authentication: https://cornucopia.owasp.org/taxonomy/asvs-5.0/06-authentication/
- NIST SP 800-63B-4: https://pages.nist.gov/800-63-4/sp800-63b.html