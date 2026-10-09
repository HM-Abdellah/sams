# SAMS Operations Runbook

Status: Normative operational runbook
Version: 2026-10-06

## 1. Purpose

This runbook is for the SAMS technical operator responsible for deployment, maintenance, recovery, and production safety.

The goal is to avoid improvisation during routine work and incidents.

## 2. Operating principles

- Production is real school infrastructure.
- Never experiment on production data.
- Back up before migrations/major maintenance.
- Verify after every production change.
- Keep recovery artifacts independent of one workstation.
- Prefer reversible operations.
- Record material operational changes.

## 3. Pre-production deployment

### Backend prerequisites

Supported baseline:
- Apache 2.4+
- PHP 8.3
- MariaDB/MySQL
- Composer 2

Required PHP extensions include:
- pdo_mysql
- mbstring
- dom
- xml
- xmlwriter
- zip
- gd

### Production configuration

Production configuration MUST include:
- environment=production;
- debug=false;
- correct base path;
- secure session settings;
- production database credentials;
- approved security configuration.

Never copy demo credentials into production.

## 4. Build and deploy

From the repository root:

```bash
cd backend
composer install --no-dev --no-interaction --prefer-dist --no-progress
composer check-platform-reqs --no-dev
```

Build the React frontend from `frontend`:

```bash
npm ci --no-audit --no-fund
npm run build -- --base /sams/
```

Then:
1. deploy the generated static bundle;
2. verify Apache routing;
3. verify API route health;
4. verify login;
5. verify one admin read workflow;
6. verify one teacher attendance read/write workflow in a controlled test environment before enabling live use.

## 5. Health check

Canonical API health:
`/api/v1/health`

Verify:
- HTTP success;
- JSON contract;
- expected service identifier;
- no debug output.

Do not assume `/public/api/v1/health` is correct; the canonical route is under the application's configured API base.

## 6. Bootstrap administrator

For an initial installation:

```bash
php scripts/create_admin.php
```

Before real deployment:
- inspect the current script;
- provide a secure production password;
- verify correct school association;
- verify the account is active;
- record the bootstrap event operationally without storing the password.

The bootstrap script should eventually accept explicit operator inputs rather than relying on fixed identity defaults.

## 7. Account operations

### Add administrator

Use:
`Admin → Users → Add Administrator`

Do not use a SQL INSERT for normal administration.

### Teacher onboarding

Use:
`Admin → Onboarding`

Issue/rotate the school's onboarding mechanism through the application.

Do not manually create teacher passwords in the database.

### Disable a compromised account

Use the admin lifecycle action to suspend/deactivate the account.

Then verify:
- session invalidation;
- account status;
- audit entry.

### Reset a user password

Use the controlled admin reset action.

The administrator does not choose or learn the final user password.

## 8. Backup

Before migrations:

```bash
mysqldump -u <app-db-user> -p --single-transaction --routines --triggers sams > sams_backup.sql
```

Store the backup outside:
- Git;
- web root;
- a single unprotected machine.

Never publish or commit the resulting file.

## 9. Restore

Restore to a controlled database:

```bash
mysql -u <recovery-user> -p sams < sams_backup.sql
```

Then validate:
1. tables;
2. schema/migration state;
3. active academic year;
4. recent attendance;
5. user accounts;
6. teacher assignments;
7. reports;
8. login;
9. audit logs.

Never test restore by overwriting the only production copy.

## 10. Academic-year rollover

Do not delete the previous year and start over.

Expected operating model:

`current year → validation → close → create new year → configure classes/assignments → activate new year`

Before implementation of a full rollover wizard, verify the current schema and business relationships.

Required invariants:
- old attendance remains attached to old year;
- new attendance starts in new year;
- student identity persists;
- teacher identity persists;
- placements/assignments are year-scoped;
- closed year remains historically readable;
- one unintended duplicate active year is not created.

## 11. Production maintenance

Routine maintenance includes:
- dependency security updates;
- OS/server patches;
- certificate review;
- backup checks;
- restore tests;
- disk-space checks;
- audit-log review;
- account review;
- old artifacts cleanup.

Never perform broad cleanup on production without identifying exactly what will be deleted.

## 12. Low disk-space procedure

When storage pressure is detected:

1. Measure actual usage.
2. Identify the largest directories/files.
3. Separate source/data from regenerable caches.
4. Preserve uncommitted work.
5. Remove only known regenerable cache/artifact data.
6. Re-measure.
7. Verify builds/tests afterward.

For the Codespace development environment, regenerable caches may include Copilot, Playwright, npm, Puppeteer, and Go build caches.

Do not blindly run destructive Docker cleanup commands when Docker state is inconsistent.

If needed, use a controlled Codespace rebuild only after preserving worktree changes.

## 13. Dependency maintenance

Before updating dependencies:
1. Run the current audit.
2. Identify affected packages/advisories.
3. Check release notes for breaking changes.
4. Update the smallest justified scope.
5. Run typecheck/lint/build/tests.
6. Review the diff.

Do not use broad upgrades as a substitute for engineering analysis.

## 14. Release verification

For meaningful releases, run:
- backend tests;
- frontend typecheck;
- frontend lint;
- frontend build;
- integration tests;
- API smoke tests;
- critical Playwright flows;
- security tests;
- secret scan;
- exposed-file scan;
- dependency audits;
- database/backup verification where relevant.

Use the security checklist to record evidence.

## 15. Rollback

Before deployment:
- record current release identifier;
- back up the database if schema/data changes are involved;
- know the previous working application version.

Rollback process:
1. stop rollout;
2. restore known-good application release;
3. verify database compatibility;
4. restore DB only when necessary and controlled;
5. verify login/attendance/reports;
6. record the event.

Never blindly roll application code backward across an incompatible schema migration.

## 16. Incident escalation

Use `Incident Response.md` when:
- admin account may be compromised;
- sensitive data may have been exposed;
- production database may be corrupted;
- secrets may have leaked;
- ransomware/malware is suspected;
- recovery from backup is required.

## 17. Operational access separation

Where feasible, keep distinct credentials for:
- school administration;
- application deployment;
- database emergency access;
- repository access;
- backup storage.

Do not use the same password for multiple privileged systems.

## 18. Daily/weekly/monthly cadence

### Daily
- service availability check;
- recent backup check;
- obvious login/security alerts.

### Weekly
- backup validation;
- audit review;
- disk usage;
- failed-authentication review;
- pending onboarding review.

### Monthly or per agreed cadence
- restore test;
- dependency audit;
- privileged-account review;
- recovery/runbook review;
- threat-model update for material changes.

The exact cadence should be adjusted to the school's operational needs and recorded rather than assumed.

## 19. Production change record

For each material operational change, record:

`Date:
Operator:
Change:
Reason:
Pre-change backup:
Expected result:
Verification:
Rollback plan:
Observed result:
`

## 20. References

- SAMS deployment/backup guide: `docs/DEPLOYMENT_AND_BACKUP.md`
- SAMS architecture: `docs/ARCHITECTURE.md`
- NIST CSF 2.0: https://www.nist.gov/cyberframework
- NIST SP 800-61r3: https://csrc.nist.gov/pubs/sp/800/61/r3/final

