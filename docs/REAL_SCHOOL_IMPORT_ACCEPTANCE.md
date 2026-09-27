# Real School Import Acceptance

This is a manual-only acceptance procedure for the real school roster. Real .xlsx/.md files stay outside Git and are never required by CI.

## Safety boundary

Run the acceptance only against a disposable isolated MariaDB database containing a copy of the target-year SAMS database.

The harness requires:

- SAMS_REAL_ACCEPTANCE=1
- a configured database name containing _acceptance or _staging
- a database name that is not sams and does not contain prod/production
- a real .xlsx input
- the MarkItDown-generated .md input from the same workbook
- the target academic-year id from the isolated database

The script refuses to start when these safety conditions are not met.

## 1. Create the isolated database

Create a dump from the real SAMS database without changing the real database:

```bash
mariadb-dump -u root -p --single-transaction --routines --triggers sams > sams-real-acceptance.sql
```

Create a disposable database:

```bash
mariadb -u root -p -e "CREATE DATABASE sams_acceptance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mariadb -u root -p sams_acceptance < sams-real-acceptance.sql
```

Docker can be used instead of a host MariaDB installation:

```bash
docker run -d \
  --name sams-real-acceptance-db \
  -e MARIADB_ROOT_PASSWORD=root \
  -e MARIADB_DATABASE=sams_acceptance \
  -p 3307:3306 \
  mariadb:11.4
```

Then import the dump into that container.

## 2. Point the local SAMS config at the isolated DB

Use backend/config/database.php and set it to the isolated database only.

Example:

```php
<?php

return [
    'host' => '127.0.0.1',
    'port' => 3306,
    'database' => 'sams_acceptance',
    'username' => 'root',
    'password' => '...',
    'charset' => 'utf8mb4',
];
```

When Docker maps MariaDB to port 3307, use 3307 instead.

Keep this file uncommitted; it is already ignored by Git.

## 3. Identify the target academic year

Use the isolated database:

```sql
SELECT id, name, starts_on, ends_on, is_active
FROM academic_years
ORDER BY starts_on DESC, id DESC;
```

For the current real roster, the source year is 2025/2026, so the target year should normalize to the corresponding isolated SAMS academic year (normally 2025-2026).

## 4. Install dependencies

From the repository root:

```bash
cd backend
composer install
cd ..
```

## 5. Run the complete real acceptance

PowerShell:

```powershell
$env:SAMS_REAL_ACCEPTANCE="1"
php scripts/real_school_import_acceptance.php \
  "C:\path\to\ListEleve_20260113.xlsx" \
  "C:\path\to\ListEleve_20260113.md" \
  123
```

Replace 123 with the target academic-year id from the isolated database.

The active admin user is auto-detected. A fourth argument can be supplied when a specific isolated admin id must be used.

Bash:

```bash
SAMS_REAL_ACCEPTANCE=1 \
php scripts/real_school_import_acceptance.php \
  "/path/to/ListEleve_20260113.xlsx" \
  "/path/to/ListEleve_20260113.md" \
  123
```

## 6. What the harness verifies

The run is considered successful only when all of these pass:

1. Real XLSX parser validation.
2. Real Markdown parser validation.
3. Exactly 27 classes / 921 student rows in both representations.
4. Source-year compatibility with the selected target academic year.
5. XLSX ↔ Markdown semantic equivalence.
6. Exactly the previously observed representation differences: 2 birth-place blank/non-blank conversions and 1 whitespace-only last-name difference.
7. Real XLSX staging without changing students/enrollments.
8. Real Markdown staging without changing students/enrollments.
9. Equality of the two staging representations.
10. Real reconciliation of all 27 classes / 921 rows with zero conflicts.
11. Real commit into the isolated target-year database.
12. Exact student/enrollment deltas matching the commit summary.
13. All 921 rows marked imported.
14. A second commit of the same batch is idempotent.
15. A second real batch is prepared, one attendance-free target enrollment is temporarily removed inside the isolated DB, and a commit-time audit trigger intentionally fails after the import mutations.
16. The injected failure leaves the isolated DB in the pre-commit state and leaves the batch retryable.
17. The trigger is removed, the same real batch commits successfully, recreating exactly the removed enrollment.
18. A replay of that recovery commit is idempotent.

The rollback probe changes only the disposable acceptance database. Its net final state is restored after the recovery commit.

## 7. Evidence and privacy

The harness prints only non-PII evidence such as:

- isolated database name
- target academic year
- SHA-256 hashes of the two input files
- class/student counts
- reconciliation counters
- student/enrollment deltas
- batch ids
- pass/fail checks

It does not print Massar codes, student names, birth dates, or other row-level student data.

The real source files must never be committed to the repository.