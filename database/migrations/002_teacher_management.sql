-- SAMS teacher management migration for existing installations.
-- Run once after the base schema is installed.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) NULL AFTER username,
    ADD COLUMN IF NOT EXISTS phone VARCHAR(30) NULL AFTER full_name,
    ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER phone,
    ADD COLUMN IF NOT EXISTS last_seen_at DATETIME NULL AFTER last_login_at;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_employee_id ON users (employee_id);

UPDATE users
SET employee_id = username
WHERE role = 'teacher' AND employee_id IS NULL;

CREATE TABLE IF NOT EXISTS subjects (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(30) NOT NULL,
    name_fr VARCHAR(120) NOT NULL,
    name_ar VARCHAR(120) NOT NULL,
    name_en VARCHAR(120) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_subjects_code (code),
    KEY idx_subjects_active (is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS teacher_teachings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    teacher_id BIGINT UNSIGNED NOT NULL,
    subject_id BIGINT UNSIGNED NOT NULL,
    class_id BIGINT UNSIGNED NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_teacher_teachings (teacher_id, subject_id, class_id),
    KEY idx_teacher_teachings_teacher (teacher_id),
    KEY idx_teacher_teachings_subject (subject_id),
    KEY idx_teacher_teachings_class (class_id),
    CONSTRAINT fk_teacher_teachings_teacher
        FOREIGN KEY (teacher_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_teacher_teachings_subject
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_teacher_teachings_class
        FOREIGN KEY (class_id) REFERENCES classes(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;
