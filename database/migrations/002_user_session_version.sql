-- SAMS migration 002: invalidate authenticated sessions after sensitive
-- account changes such as password reset, role change, or deactivation.

USE sams;

ALTER TABLE users
    ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 1
    AFTER locked_until;
