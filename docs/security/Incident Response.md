# SAMS Incident Response Plan

Status: Normative operational plan
Version: 2026-10-06

## 1. Purpose

This document defines how SAMS handles suspected or confirmed security incidents and major operational incidents.

The goal is to reduce harm, preserve evidence, restore trusted service, and learn from the event.

NIST SP 800-61r3 integrates incident response with broader cybersecurity risk management and supersedes the older SP 800-61r2 guidance. SAMS follows that direction at a practical school-system scale.

## 2. Incident types

Examples:
- administrator account compromise;
- teacher account compromise;
- suspicious privilege escalation;
- cross-school data exposure;
- stolen credentials;
- secret leaked to Git;
- malware/ransomware;
- database corruption;
- production outage;
- accidental destructive operation;
- compromised backup;
- malicious import/upload.

## 3. Roles

### Technical operator
Owns technical containment, evidence preservation, recovery, release verification, and infrastructure actions.

### School administrator
Owns school/business decisions such as account suspension, user verification, communication, and operational continuity.

### Additional support
When required, involve:
- hosting/provider support;
- security specialist;
- school leadership;
- legal/privacy authority as required by the deployment context.

## 4. Severity

### P0 — Critical
Examples:
- confirmed privileged-account compromise;
- confirmed broad student-data exposure;
- destructive ransomware;
- unrecoverable database outage.

Response:
- immediate containment;
- production access may be suspended;
- executive/school leadership notification;
- recovery plan activated.

### P1 — High
Examples:
- one confirmed compromised account;
- serious authorization bypass;
- sensitive export leakage.

Response:
- urgent containment;
- investigate scope;
- targeted recovery.

### P2 — Medium
Examples:
- localized security control failure without evidence of exploitation;
- suspicious repeated probing;
- recoverable operational issue.

Response:
- investigate and remediate quickly.

### P3 — Low
Examples:
- minor policy drift;
- low-impact misconfiguration with no current exploit evidence.

Response:
- document and fix through normal engineering process.

## 5. Incident lifecycle

`Detect → Triage → Contain → Investigate → Eradicate/Fix → Recover → Verify → Review`

Do not skip evidence preservation when compromise is plausible.

## 6. First-response rules

When an incident is suspected:
1. Do not panic-delete logs or evidence.
2. Do not rotate every credential blindly before understanding what may be compromised, unless immediate containment requires it.
3. Record what was observed and when.
4. Identify affected accounts/resources/systems.
5. Contain the narrowest scope that stops ongoing harm.
6. Preserve a clean recovery path.

## 7. Account compromise playbook

Example:

`Suspicious admin/teacher account → revoke/disable → preserve evidence → reset/recover → rotate affected credentials if needed → review audit → validate clean access`

Actions may include:
- account suspension;
- session-version invalidation;
- SAMS Code reissue;
- password reset;
- review of recent privileged actions;
- review of recovery changes;
- review of new/changed admin accounts.

## 8. Data exposure playbook

1. Identify exactly what data may have been exposed.
2. Identify the tenant/school and time range.
3. Stop the exposure path.
4. Preserve relevant logs.
5. Determine whether data was only readable or also modified.
6. Restore integrity if needed.
7. Escalate communication/notification according to the school's legal/privacy obligations and incident severity.
8. Record lessons learned.

Do not make unsupported claims that no data was accessed; distinguish:
- not observed;
- not proven;
- confirmed.

## 9. Secret leak playbook

If a real secret appears in Git:
1. Treat it as compromised.
2. Stop further propagation.
3. Rotate/revoke the credential.
4. Remove it from active working copies.
5. Remove the secret from repository history when appropriate.
6. Verify the replacement credential.
7. Add/strengthen preventive controls.
8. Record the incident.

Deleting the file alone is not sufficient.

## 10. Ransomware/destructive storage playbook

`Contain host/storage → isolate → preserve evidence → verify clean backups → rebuild/restore → validate → rotate credentials`

Never assume the newest backup is clean.

## 11. Evidence handling

Preserve, where relevant:
- application audit logs;
- web/server logs;
- database logs;
- Git history;
- relevant configuration versions;
- timestamps;
- affected request IDs where available.

Do not store:
- passwords;
- active session cookies;
- reset tokens;
- private keys

inside incident notes.

## 12. Recovery verification

After remediation:
- verify privileged accounts;
- verify role boundaries;
- verify school scope;
- verify API health;
- verify attendance reads/writes;
- verify audit logging;
- verify backup;
- verify monitoring/alerting;
- run focused regression/security tests.

## 13. Post-incident review

Within the post-incident review, record:
- root cause;
- contributing factors;
- detection gap;
- containment gap;
- recovery gap;
- permanent fixes;
- documentation updates;
- new tests;
- threat-model changes.

Every material incident should improve the system or its operations.

## 14. References

- NIST SP 800-61r3: https://csrc.nist.gov/pubs/sp/800/61/r3/final
- NIST CSF 2.0: https://www.nist.gov/cyberframework
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

