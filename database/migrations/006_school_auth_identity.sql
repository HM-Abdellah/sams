-- SAMS migration 006: school tenancy, account lifecycle, and login identities.
--
-- This migration preserves users.id and all existing business foreign keys.
-- Existing single-school data is placed in one migrated tenant.
-- Legacy username login remains valid until the canonical v1 auth path is enabled.

USE sams;

CREATE TABLE schools (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(150) NOT NULL,
    status ENUM('active', 'suspended', 'archived') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_schools_code (code),
    KEY idx_schools_status (status)
) ENGINE=InnoDB;

INSERT INTO schools (code, name, status)
SELECT 'SAMS-001', 'Migrated SAMS School', 'active'
WHERE NOT EXISTS (
    SELECT 1 FROM schools WHERE code = 'SAMS-001'
);

SET @sams_school_id := (
    SELECT id FROM schools WHERE code = 'SAMS-001' LIMIT 1
);

ALTER TABLE academic_years
    ADD COLUMN school_id BIGINT UNSIGNED NULL AFTER id;

UPDATE academic_years
SET school_id = @sams_school_id
WHERE school_id IS NULL;

ALTER TABLE academic_years
    DROP INDEX uq_academic_years_name,
    MODIFY school_id BIGINT UNSIGNED NOT NULL,
    ADD UNIQUE KEY uq_academic_years_school_name (school_id, name),
    ADD KEY idx_academic_years_school_active (school_id, is_active),
    ADD CONSTRAINT fk_academic_years_school
        FOREIGN KEY (school_id) REFERENCES schools(id)
        ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE users
    ADD COLUMN school_id BIGINT UNSIGNED NULL AFTER id,
    ADD COLUMN account_status ENUM('active', 'suspended', 'deactivated')
        NOT NULL DEFAULT 'active' AFTER role;

UPDATE users
SET school_id = @sams_school_id
WHERE school_id IS NULL;

UPDATE users
SET account_status = CASE
    WHEN is_active = 1 THEN 'active'
    ELSE 'deactivated'
END;

ALTER TABLE users
    MODIFY school_id BIGINT UNSIGNED NOT NULL,
    MODIFY password_hash VARCHAR(255) NULL,
    ADD KEY idx_users_school_role_status (school_id, role, account_status),
    ADD CONSTRAINT fk_users_school
        FOREIGN KEY (school_id) REFERENCES schools(id)
        ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE teacher_teachings
    ADD COLUMN status ENUM('active', 'inactive')
        NOT NULL DEFAULT 'active' AFTER class_id,
    ADD KEY idx_teacher_teachings_status (status);

CREATE TABLE sams_login_codes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    code_hash CHAR(64) NOT NULL,
    issued_by BIGINT UNSIGNED NULL,
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sams_login_codes_hash (code_hash),
    KEY idx_sams_login_codes_user_active (user_id, revoked_at),
    CONSTRAINT fk_sams_login_codes_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sams_login_codes_issuer
        FOREIGN KEY (issued_by) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE school_onboarding_codes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    school_id BIGINT UNSIGNED NOT NULL,
    code_hash CHAR(64) NOT NULL,
    created_by BIGINT UNSIGNED NULL,
    expires_at TIMESTAMP NULL,
    revoked_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_school_onboarding_codes_hash (code_hash),
    KEY idx_school_onboarding_codes_school_active (school_id, revoked_at, expires_at),
    CONSTRAINT fk_school_onboarding_codes_school
        FOREIGN KEY (school_id) REFERENCES schools(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_school_onboarding_codes_creator
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;CREATE TABLE teacher_onboarding_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    school_id BIGINT UNSIGNED NOT NULL,
    onboarding_code_id BIGINT UNSIGNED NOT NULL,
    request_token_hash CHAR(64) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    employee_id VARCHAR(50) NULL,
    phone VARCHAR(30) NULL,
    status ENUM('pending', 'approved', 'rejected', 'expired')
        NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP NOT NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    reviewed_at TIMESTAMP NULL,
    rejection_reason VARCHAR(255) NULL,
    created_user_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_teacher_onboarding_request_token (request_token_hash),
    KEY idx_teacher_onboarding_school_status (school_id, status, created_at),
    KEY idx_teacher_onboarding_expiry (status, expires_at),
    KEY idx_teacher_onboarding_user (created_user_id),
    CONSTRAINT fk_teacher_onboarding_school
        FOREIGN KEY (school_id) REFERENCES schools(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_teacher_onboarding_code
        FOREIGN KEY (onboarding_code_id) REFERENCES school_onboarding_codes(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_teacher_onboarding_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_teacher_onboarding_user
        FOREIGN KEY (created_user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- No SAMS Codes are seeded during migration.
-- The application must issue a cryptographically random code and expose
-- the plaintext only at explicit issuance/reissue time.
-- This avoids creating a predictable credential from user id/role.

-- Audit entries must retain tenant ownership even if the actor is later removed.
ALTER TABLE audit_logs
    ADD COLUMN school_id BIGINT UNSIGNED NULL AFTER user_id,
    ADD KEY idx_audit_school_date (school_id, created_at),
    ADD CONSTRAINT fk_audit_school
        FOREIGN KEY (school_id) REFERENCES schools(id)
        ON UPDATE CASCADE ON DELETE SET NULL;

UPDATE audit_logs a
INNER JOIN users u ON u.id = a.user_id
SET a.school_id = u.school_id
WHERE a.school_id IS NULL;

-- Legacy users remain operational during the transition; the new lifecycle field
-- is the authoritative state for new account-management code.
UPDATE users
SET account_status = CASE
    WHEN is_active = 1 THEN 'active'
    ELSE 'deactivated'
END
WHERE account_status IS NULL;