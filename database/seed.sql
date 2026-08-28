-- SAMS development seed data.
-- This file intentionally contains no passwords or real people.
-- Create the local administrator with scripts/create_admin.php after import.

USE sams;

INSERT INTO academic_years (name, starts_on, ends_on, is_active)
VALUES ('2026/2027', '2026-09-01', '2027-07-31', TRUE)
ON DUPLICATE KEY UPDATE
    starts_on = VALUES(starts_on),
    ends_on = VALUES(ends_on),
    is_active = TRUE;

INSERT INTO classes (academic_year_id, name, level, branch)
SELECT id, '2BACSPF-A', '2BAC', 'Sciences Physiques'
FROM academic_years
WHERE name = '2026/2027'
  AND NOT EXISTS (
      SELECT 1 FROM classes c
      WHERE c.academic_year_id = academic_years.id
        AND c.name = '2BACSPF-A'
  );
