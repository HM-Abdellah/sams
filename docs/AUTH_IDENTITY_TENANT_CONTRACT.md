# SAMS Auth, Identity & Tenant Contract

## Scope

This document defines the backend contract required before the React authentication UX.
The legacy PHP UI/API remains supported during migration.

## Identity decisions

- users.id remains the immutable internal identity and historical foreign-key target.
- username remains a legacy compatibility field; it is not the future primary login identity.
- A user belongs to exactly one school through users.school_id.
- SAMS Code is a reissuable login identifier, not a password and not a database ID.
- SAMS Codes are stored as SHA-256 hashes; plaintext is shown only at explicit issuance/reissue time.
- The application issues role-prefixed random codes, revokes the previous active code on reissue, and increments the target user's session_version.
- Account recovery never creates a second user record.
- Existing session_version invalidation remains the global session-revocation primitive.

## School boundary

- schools is the tenant root.
- Academic years belong to one school.
- Classes inherit school ownership through their academic year.
- Students inherit school ownership through their class.
- Attendance inherits school ownership through enrollment/class.
- Teacher assignments inherit school ownership through teacher + class.
- Every authenticated resource query/mutation must enforce the actor school scope on the server.

## Teacher onboarding

The implemented flow is:

school onboarding code -> PENDING request -> ADMIN APPROVED request -> user activation -> ACTIVE account -> initial SAMS Code.

A request is not an account and never grants operational access.
Approval creates/reuses exactly one teacher user inside the request school.
Activation sets the password, enables login, and issues the initial SAMS Code once.
The implementation stores onboarding-code and request-token hashes only, rotates school onboarding codes, expires requests, records request origin metadata for rate limiting, and protects admin review actions with authenticated school scope + CSRF.## Join mechanism

- A school may expose an onboarding QR/short code.
- The join code is only a request-entry mechanism.
- Join codes are stored hashed and can be rotated/revoked.
- The join mechanism never authenticates a teacher and never grants class access.
- Requests expire and are rate-limited at the HTTP layer.

## Account lifecycle

Request lifecycle:
pending | approved | rejected | expired

Account lifecycle:
active | suspended | deactivated

is_active remains temporarily for compatibility and must stay synchronized with account lifecycle changes.

## Teaching assignments

Teacher access is derived from explicit teaching assignments:
Teacher + Class + Subject + Academic Year + Status

The existing teacher_classes table remains a derived compatibility/access table during migration.
No new endpoint may grant class access independently of a valid teaching assignment.

## Recovery

- Reissuing a SAMS Code keeps the same users.id.
- Password reset keeps the same users.id.
- Password reset/reissue/revocation increments session_version.
- Historical attendance and audit references therefore remain intact.

## API direction

Canonical React-facing auth endpoints will be introduced under /api/v1/auth.
Legacy api/auth.php remains until React parity and E2E verification are complete.

Target login payload:
{ "sams_code": "T024", "password": "..." }

Successful login returns internal user identity, role, school scope, and CSRF/session state.
It never returns password hashes or SAMS Code hashes.

## Non-goals for this foundation

- No React implementation yet.
- No offline attendance synchronization yet.
- No per-device session dashboard yet; global session_version revocation remains the current primitive.

## Transition note

Migration 006 backfills and then requires school ownership on existing installations.
The fresh-install schema now also requires users.school_id and academic_years.school_id. Application writer services fail closed when authenticated school scope is omitted, and repository boundaries used by signatures enforce school ownership through the class/academic-year and user relationships.

## Migration order

1. Introduce school/identity/onboarding tables and backfill the existing single-school data into one tenant.
2. Add strict tenant scoping to repositories/services.
3. Add SAMS Code issuance/reissue and canonical auth endpoints.
4. Add teacher join request + admin approval/activation workflow.
5. Add recovery/session revocation verification.
6. Freeze the backend contract.
7. Build React auth UX against that contract.

## Acceptance baseline

Before React auth work is accepted:

- one existing school is migrated without changing user IDs;
- old attendance/history foreign keys remain valid;
- cross-school resource reads/writes are denied;
- SAMS Code login works for active accounts only;
- reissue/reset does not duplicate users;
- approval does not grant class access without an assignment;
- suspension/deactivation invalidates access;
- security-sensitive mutations remain authenticated, authorized, CSRF-protected where applicable, transactional, and audited.