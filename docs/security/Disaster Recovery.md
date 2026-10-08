# SAMS Disaster Recovery Plan

Status: Normative operational plan
Version: 2026-10-06

## 1. Purpose

This document defines how SAMS is restored after a major infrastructure or data-loss event.

Disaster recovery covers:
- school server failure;
- database corruption;
- accidental destructive operations;
- ransomware/destructive storage events;
- backup failure;
- application deployment failure;
- loss of the primary operator workstation;
- prolonged infrastructure outage.

## 2. Recovery objectives

RTO = target maximum acceptable time to restore service.

RPO = target maximum acceptable amount of data loss measured from the latest recoverable backup.

SAMS has not yet selected final production RTO/RPO values. These MUST be defined before real-school operational sign-off because the correct values depend on:
- school attendance workflow;
- backup frequency;
- storage topology;
- operator availability;
- infrastructure budget;
- acceptable manual fallback.

Do not invent an RTO/RPO value simply to complete documentation.

## 3. Intended production topology

Current intended school topology:
- central Windows machine/server;
- Apache 2.4+;
- PHP 8.3;
- MariaDB/MySQL;
- React static production bundle;
- teachers connect from phones/tablets/laptops over the school network.

The primary database/application host is the source of truth.

Teacher/admin devices are clients and MUST NOT be the only location where school data exists.

## 4. Backup policy

Minimum operational requirements:
- database backup before schema migrations;
- periodic scheduled backups during the school year;
- at least one backup copy independent from the production machine;
- protected access to backup files;
- periodic restoration tests;
- backup metadata sufficient to identify date/schema/application baseline.

Backups MUST NOT live only inside:
- the Git repository;
- the public web root;
- the same unprotected directory as production data.

## 5. What a valid backup must preserve

At minimum:
- database structure;
- database data;
- migration/schema state;
- application release identifier;
- required production configuration references without exposing secrets;
- relevant uploaded/operational files when the deployed system actually stores them outside the DB.

## 6. Restore procedure

### Phase A — contain

1. Stop destructive activity.
2. Preserve the failing environment if forensic investigation may be needed.
3. Prevent additional writes when data integrity is uncertain.
4. Identify the last known good recovery point.

### Phase B — restore to controlled infrastructure

1. Prepare a clean/controlled database instance.
2. Restore the database backup.
3. Restore the compatible application release.
4. Restore required non-secret configuration from protected sources.
5. Apply only the migrations compatible with the restored baseline.
6. Do not overwrite the only surviving production copy during the first restore attempt.

### Phase C — validate

Verify:
- tables exist;
- expected migration state;
- active academic year is correct;
- recent attendance exists;
- user accounts exist;
- teacher assignments exist;
- reports can load;
- authentication works;
- API health works;
- audit records remain coherent.

### Phase D — return to service

1. Confirm application correctness.
2. Announce controlled recovery to school administration.
3. Resume writes.
4. Take a fresh backup of the recovered system.
5. Record the incident and recovery evidence.

## 7. Scenario playbooks

### School PC/server failure

`Hardware failure → replace host → restore application/database → validate → resume`

Business goal:
The school must not lose historical attendance simply because the original server hardware failed.

### Database corruption

`Detect corruption → stop writes → identify last valid backup → restore to controlled instance → integrity checks → resume`

### Accidental deletion

Prefer application-level archive/deactivate workflows.

If important data was actually deleted:
- stop further destructive operations;
- identify affected records;
- use audit history to determine what happened;
- restore or selectively recover from backup using a controlled procedure.

### Ransomware/destructive storage incident

`Contain → isolate affected host/storage → preserve evidence → restore from independent clean backup → validate → rotate affected credentials if needed`

Do not restore a potentially contaminated backup as the only recovery path.

### Deployment failure

`detect → stop rollout → rollback/redeploy known-good release → verify DB compatibility → smoke test`

Never roll back application code across a database migration without checking schema compatibility.

## 8. Backup restoration testing

At a minimum:
- perform a controlled restore test periodically;
- verify the application can actually run against the restored data;
- verify recent attendance;
- verify account login;
- verify reports;
- record time-to-restore evidence;
- record any missing files/steps.

A restore test must not overwrite the only production database.

## 9. Recovery dependencies

Recovery depends on maintaining:
- access to the production application package/repository;
- database backups;
- migration history;
- protected production configuration;
- operator credentials stored safely outside the application repository;
- documented recovery steps;
- access to the target server.

## 10. Single-operator risk

SAMS must not depend on one workstation containing the only copy of:
- source code;
- production backup;
- recovery credentials;
- deployment instructions.

At least the recovery artifacts needed to restore service MUST exist independently of the operator's everyday PC.

## 11. Recovery evidence

Every recovery exercise or actual incident records:
- incident date/time;
- cause;
- recovery point used;
- application version;
- DB/schema version;
- restore duration;
- validation results;
- data gap, if any;
- follow-up changes.

## 12. References

- NIST SP 800-34 Contingency Planning Guide: https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final
- NIST CSF 2.0: https://www.nist.gov/cyberframework
- NIST SP 800-61r3: https://csrc.nist.gov/pubs/sp/800/61/r3/final
- SAMS deployment/backup guide: `docs/DEPLOYMENT_AND_BACKUP.md`

