-- SAMS development/demo seed data.
-- Never use real student or teacher data here.
-- Never commit plaintext production passwords.

USE sams;

INSERT INTO academic_years (name, starts_on, ends_on, is_active)
VALUES ('2026/2027', '2026-09-01', '2027-07-31', TRUE)
ON DUPLICATE KEY UPDATE
    starts_on = VALUES(starts_on),
    ends_on = VALUES(ends_on);

-- User passwords intentionally use a placeholder. Generate real hashes with:
-- php -r "echo password_hash('CHANGE_ME', PASSWORD_DEFAULT), PHP_EOL;"
INSERT INTO users (username, full_name, password_hash, role)
VALUES ('admin.demo', 'SAMS Administrator', '$2y$10$REPLACE_WITH_A_REAL_PASSWORD_HASH', 'admin')
ON DUPLICATE KEY UPDATE
    full_name = VALUES(full_name),
    role = VALUES(role);

INSERT INTO classes (academic_year_id, name, level, branch)
SELECT id, '2BACSPF-A', '2BAC', 'Sciences Physiques'
FROM academic_years
WHERE name = '2026/2027'
  AND NOT EXISTS (
      SELECT 1 FROM classes c
      WHERE c.academic_year_id = academic_years.id
        AND c.name = '2BACSPF-A'
  );
