# SAMS Data Security Policy

Status: Normative
Version: 2026-10-06

## 1. Purpose

This document defines how SAMS protects school data across its full lifecycle:

`collect → validate → use → store → report → archive → backup → recover`

It focuses on data confidentiality, integrity, availability, and correct school/year scoping.

## 2. Protected data

SAMS may contain:
- student identity and school records;
- teacher identity and assignment information;
- attendance records;
- classes and academic-year structure;
- onboarding and account metadata;
- audit logs;
- reports and signatures;
- import files and derived data;
- operational configuration.

Treat school/student information as sensitive internal data even when individual fields appear harmless.

## 3. Data classification

Use these working categories:

### Public
Information intentionally published by the school/application.

### Internal
Operational information not intended for public disclosure.

### Sensitive
Student, teacher, attendance, account, audit, import, or operational records that could cause harm if disclosed or altered.

### Restricted
Passwords, session credentials, reset tokens, database credentials, private keys, production secrets, and security evidence.

Restricted data MUST receive the strongest controls.

## 4. Tenant isolation

`schools` is the tenant root.

Rules:
- Every authenticated resource query/mutation MUST enforce the actor's `school_id`.
- A valid resource ID is never sufficient authorization.
- Cross-school reads MUST be denied.
- Cross-school writes MUST be denied.
- Audit records must retain school context where applicable.
- Imports must be bound to the target school.
- Reports must be generated within an authorized school scope.

Current repository relationships intentionally derive school ownership through school, academic year, class, student/enrollment, attendance, and teacher assignments.

## 5. Identity and historical integrity

A person's identity MUST remain stable across academic years.

Prefer:
- one student identity with year-specific enrollment/placement;
- one teacher identity with year-specific assignments;
- one account identity across its lifetime.

Do not create duplicate people/accounts merely because the academic year changes.

## 6. Academic-year data lifecycle

An academic year is a historical boundary.

Recommended lifecycle:

`configured → active → closed → historical/archive`

Rules:
- Attendance records remain bound to the correct year/context.
- Closing a year MUST NOT delete attendance history.
- A new year MUST start with new attendance context.
- Student and teacher identities MAY continue across years.
- Enrollments, class placements, and teaching assignments belong to an academic period.
- Historical reports MUST remain reproducible from the historical dataset.
- Normal admin workflows SHOULD prefer archive/deactivate over destructive delete.

The exact rollover implementation must follow the actual schema and business model; do not infer it from UI labels alone.

## 7. Database security

Production database access MUST:
- use a dedicated application account;
- apply least privilege;
- avoid using the database root/superuser for normal application runtime;
- restrict network exposure;
- use TLS when database traffic traverses an untrusted network;
- keep credentials outside Git;
- separate production from development/test databases.

Application SQL:
- MUST use parameterized queries/prepared statements;
- MUST validate semantic input before persistence;
- MUST use transactions where a multi-step mutation must remain atomic.

## 8. Data integrity

Attendance and other business records require:
- foreign-key integrity;
- unique constraints where appropriate;
- transactional mutation;
- concurrency checks where required;
- valid academic-year context;
- assignment/ownership checks;
- safe handling of partial failure.

A security control is incomplete if an attacker cannot read the data but can corrupt it.

## 9. Import security

School imports are a high-risk data boundary.

Required controls:
- file type/format validation;
- file-size limits;
- row-count/resource limits;
- parser safety;
- request/body limits;
- validation before commit;
- transactional commit;
- rollback on failure;
- synthetic fixtures for automated tests;
- no real-school exports committed to Git.

Uploaded files MUST remain outside publicly readable paths unless there is an explicit, safe download design.

## 10. Logging and audit data

Logs are operational data and may contain sensitive metadata.

MUST NOT log:
- passwords;
- session identifiers/cookies;
- reset tokens;
- database passwords;
- private keys;
- full authentication secrets.

Security audit events should capture:
- actor;
- action;
- target/resource;
- result;
- timestamp;
- school context when relevant;
- safe reason/context fields.

Logs should be protected from unauthorized modification and excessive retention.

## 11. Data minimization

APIs and UIs SHOULD return only the fields needed for the current operation.

Avoid:
- returning password hashes;
- returning token hashes;
- returning internal implementation details;
- exposing unrelated users' private data;
- embedding full database rows when a smaller DTO is sufficient.

## 12. Encryption and transport

Production application traffic MUST use HTTPS.

At rest:
- backups containing school data SHOULD be encrypted or stored on access-controlled encrypted storage;
- production disks/server access MUST be restricted;
- portable backup media MUST be protected against unauthorized access.

Do not invent custom encryption.

Use vetted platform/library cryptography and document key ownership and recovery.

## 13. Backup and recovery

Backups MUST be:
- outside Git;
- separated from the only production copy;
- access-controlled;
- periodically tested by restoration;
- protected from accidental overwrite;
- associated with enough metadata to identify the schema/version and backup time.

Minimum operational events requiring a fresh backup:
- before schema migrations;
- before major production upgrades;
- before destructive administrative maintenance.

A backup that has never been restored successfully is not sufficient evidence of recoverability.

## 14. Exports and printed reports

Exports can create a second data-disclosure surface.

Rules:
- export actions are authorization-checked;
- exports contain only necessary fields;
- exported files are stored outside public web roots;
- generated files have controlled retention;
- download links are access-controlled;
- printed reports are treated as sensitive physical records.

## 15. Human-error protection

Destructive operations should default to:
- archive;
- deactivate;
- close;
- revoke.

Where irreversible deletion is necessary, require:
- explicit permission;
- impact preview;
- confirmation;
- audit event;
- recovery consideration.

## 16. Real-school deployment rule

The production environment is not the demo environment.

Never use:
- demo passwords;
- demo accounts;
- seed/demo data;
- test databases;
- development debug configuration

against real school data.

## 17. Data security verification

At release time verify:
- school scope;
- DB permissions;
- SQL parameterization;
- import limits;
- sensitive-field omission;
- log redaction;
- backup creation;
- restore;
- historical attendance integrity;
- academic-year boundaries;
- exposed-file controls.

## 18. References

- OWASP Database Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html
- OWASP Input Validation Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP REST Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- NIST CSF 2.0: https://www.nist.gov/cyberframework

