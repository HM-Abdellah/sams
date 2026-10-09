# SAMS Threat Model

Status: Living document
Version: 2026-10-06
Method: Structured application decomposition → threat identification/ranking → mitigation → review/validation.

## 1. Purpose

This is a living threat model for SAMS.

Threat modeling is performed repeatedly, not once. Any new trust boundary, privileged workflow, data flow, integration, upload path, authentication factor, or destructive operation requires review.

## 2. Security objectives

Protect:
- confidentiality of school/student data;
- integrity of attendance and school records;
- availability of daily attendance operations;
- correct school/tenant isolation;
- correct authorization;
- account integrity;
- auditability;
- recoverability.

## 3. Assets

High-value assets:
1. Administrator accounts.
2. Teacher accounts and SAMS Codes.
3. Session state.
4. Student and attendance data.
5. Academic-year history.
6. Audit logs.
7. Database credentials.
8. Production application/configuration.
9. Backups.
10. Import files.
11. Recovery procedures and privileged operator access.

## 4. Actors

### Public visitor
Unauthenticated user reaching public pages/endpoints.

### Teacher
Authenticated non-admin user with assignment-scoped access.

### Counselor
Authenticated read-only/limited user according to documented permissions.

### Administrator
Authenticated privileged school operator.

### Technical operator
Infrastructure/deployment/recovery role responsible for system operation.

### Compromised account
Any legitimate identity controlled by an attacker.

### External attacker
Unauthenticated or opportunistic internet/LAN attacker.

### Malicious insider
Legitimate user intentionally abusing granted access.

### Accidental operator
Trusted person making a harmful mistake.

## 5. Trust boundaries

### Boundary A — Browser ↔ SAMS server
Threats:
- credential interception;
- malicious requests;
- client-side authorization bypass attempts;
- XSS;
- CSRF;
- request tampering.

### Boundary B — Public API ↔ protected API
Threats:
- forced browsing;
- anonymous use of privileged endpoints;
- function-level authorization bypass.

### Boundary C — User ↔ school tenant
Threats:
- cross-school object access;
- insecure direct object access;
- data leakage through reports/imports.

### Boundary D — Application ↔ database
Threats:
- SQL injection;
- excessive DB privilege;
- credential compromise;
- data corruption.

### Boundary E — Application ↔ filesystem
Threats:
- exposed configuration;
- log leakage;
- malicious upload;
- public access to backups/dumps.

### Boundary F — Production ↔ backup/recovery
Threats:
- backup deletion/corruption;
- unauthorized restoration;
- stale/corrupted recovery point.

### Boundary G — Developer/operator ↔ production
Threats:
- accidental destructive change;
- leaked credentials;
- deployment regression;
- single-operator failure.

## 6. Risk scoring

Use:
- Impact: 1–5
- Likelihood: 1–5
- Risk = Impact × Likelihood

Guidance:
- 20–25: Critical — release blocker.
- 12–19: High — must be mitigated or explicitly accepted before production.
- 6–11: Medium — planned mitigation and verification.
- 1–5: Low — monitor and review.

These scores are decision aids, not mathematical truth.

## 7. Primary threat register

| ID | Threat | Impact | Likelihood | Primary mitigation |
|---|---|---:|---:|---|
| T01 | Public user creates admin account | 5 | 3 | No public admin registration; server-side admin authorization |
| T02 | Teacher reaches another teacher's class data | 5 | 3 | Role + school + assignment/resource authorization |
| T03 | Cross-school data access | 5 | 2 | Mandatory school scope in repositories/services |
| T04 | Password guessing | 4 | 4 | Login throttling/lockout, safe errors, monitoring |
| T05 | Password reset abuse/account takeover | 5 | 3 | Verified recovery flow, single-use expiring tokens, rate limiting |
| T06 | XSS through school-controlled content | 4 | 3 | Safe rendering, validation, contextual encoding, CSP defense-in-depth |
| T07 | CSRF against authenticated mutations | 4 | 3 | CSRF validation on protected state-changing routes |
| T08 | API authorization bypass | 5 | 3 | Deny-by-default server-side function/resource authorization |
| T09 | SQL injection/data corruption | 5 | 2 | Prepared statements, semantic validation, DB least privilege |
| T10 | Sensitive file exposure | 5 | 2 | Public-root hardening, deny hidden/config/backup files |
| T11 | Secrets committed to Git | 5 | 2 | .gitignore, secret scans, GitHub push protection, rotation |
| T12 | Database/server failure | 5 | 2 | Backup + restore testing + recovery runbook |
| T13 | Backup failure/discoverable corruption | 5 | 2 | Multiple protected copies + scheduled restore tests |
| T14 | Human error destroys historical data | 4 | 3 | Archive/deactivate defaults, confirmations, audit |
| T15 | Academic-year rollover mixes records | 5 | 2 | Explicit year boundaries, validation, rollover workflow |
| T16 | Malicious or oversized import | 4 | 3 | File/row/body/resource limits + transactional commit |
| T17 | Admin account compromise | 5 | 2 | Strong recovery, session revocation, audit, future MFA |
| T18 | Single technical operator unavailable | 5 | 3 | Runbooks, secondary admin path, recoverable infrastructure |
| T19 | Deployment regression causes outage | 4 | 3 | Staging/test, release gates, rollback procedure |
| T20 | Ransomware or destructive storage event | 5 | 2 | Independent backups, restore testing, incident response |

## 8. High-risk attack paths

### Attack path A — privilege escalation

`Public → privileged endpoint → missing authorization → admin operation`

Required controls:
- authenticated session;
- explicit role authorization;
- school scope;
- function-level authorization;
- audit.

### Attack path B — cross-school access

`Authenticated user → guessed resource ID → repository returns another school's data`

Required controls:
- actor school scope;
- resource ownership/assignment;
- repository/service-level enforcement;
- adversarial tests.

### Attack path C — account takeover

`Credential attack/recovery abuse → session established → privileged action`

Required controls:
- throttling;
- secure sessions;
- safe recovery;
- session invalidation;
- audit.

### Attack path D — data loss

`Operator error/server failure → primary database unavailable/corrupt → no verified restore`

Required controls:
- independent backups;
- restore test;
- documented RTO/RPO;
- incident/recovery runbooks.

## 9. Security assumptions

Current assumptions:
- production deployment is centralized Apache/PHP + MySQL/MariaDB;
- canonical React/API deployment is same-origin;
- the browser is untrusted;
- the database is not directly accessible to school users;
- operator access is privileged and must be protected;
- real school data may exist in production and therefore recovery matters.

## 10. Residual risks

Known areas that require continued work:
- self-service password recovery is not yet fully implemented;
- MFA is future work;
- CORS policy needs explicit production validation because same-origin architecture should require little or no cross-origin access;
- production environment/configuration needs deployment-specific verification;
- database least-privilege runtime credentials need real-school deployment verification;
- RTO/RPO values have not yet been formally selected;
- per-device session management is not yet the current primitive;
- formal external penetration testing is not a claim of this document.

## 11. Review triggers

Update this threat model when:
- a new role is added;
- a privileged endpoint is added;
- a new integration is introduced;
- a new upload/export channel is added;
- authentication/recovery changes;
- academic-year lifecycle changes;
- offline synchronization is introduced;
- deployment topology changes;
- real-school risk profile changes;
- a security incident occurs.

## 12. References

- OWASP Threat Modeling Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html
- OWASP API Security Top 10: https://api-security.owasp.org/editions/2023/en/0x11-t10/
- OWASP API5 Broken Function Level Authorization: https://api-security.owasp.org/editions/2023/en/0xa5-broken-function-level-authorization/
- OWASP ASVS 5: https://cornucopia.owasp.org/taxonomy/asvs-5.0/
- NIST CSF 2.0: https://www.nist.gov/cyberframework

