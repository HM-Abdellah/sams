-- SAMS migration 007: revoke login codes created by the old predictable 006 seed.
-- The application had not yet exposed a real SAMS Code issuance flow, so these
-- rows are transitional credentials and must not remain usable.

USE sams;

UPDATE sams_login_codes lc
INNER JOIN users u ON u.id = lc.user_id
SET lc.revoked_at = COALESCE(lc.revoked_at, CURRENT_TIMESTAMP)
WHERE lc.revoked_at IS NULL
  AND lc.code_hash = SHA2(
      CONCAT(
          CASE u.role
              WHEN 'teacher' THEN 'T'
              WHEN 'admin' THEN 'A'
              ELSE 'C'
          END,
          LPAD(u.id, 5, '0')
      ),
      256
  );
