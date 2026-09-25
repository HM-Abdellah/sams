-- Electronic class-register workflow: per-lesson sign-off + weekly teacher certification.
CREATE TABLE IF NOT EXISTS attendance_signoffs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    class_id BIGINT UNSIGNED NOT NULL,
    teacher_id BIGINT UNSIGNED NOT NULL,
    attendance_date DATE NOT NULL,
    period TINYINT UNSIGNED NOT NULL,
    signature_data LONGTEXT NOT NULL,
    status ENUM('signed', 'needs_resign') NOT NULL DEFAULT 'signed',
    signed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    invalidated_at TIMESTAMP NULL,
    invalidated_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_attendance_signoffs_class_date_period (class_id, attendance_date, period),
    KEY idx_attendance_signoffs_teacher (teacher_id, attendance_date),
    KEY idx_attendance_signoffs_class_week (class_id, attendance_date, status),
    CONSTRAINT fk_attendance_signoffs_class
        FOREIGN KEY (class_id) REFERENCES classes(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_attendance_signoffs_teacher
        FOREIGN KEY (teacher_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_attendance_signoffs_invalidated_by
        FOREIGN KEY (invalidated_by) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_attendance_signoffs_period CHECK (period BETWEEN 1 AND 8)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attendance_week_signatures (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    class_id BIGINT UNSIGNED NOT NULL,
    teacher_id BIGINT UNSIGNED NOT NULL,
    week_start DATE NOT NULL,
    signature_data LONGTEXT NOT NULL,
    status ENUM('signed', 'needs_resign') NOT NULL DEFAULT 'signed',
    signed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    invalidated_at TIMESTAMP NULL,
    invalidated_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_attendance_week_signatures (class_id, teacher_id, week_start),
    KEY idx_attendance_week_signatures_class_week (class_id, week_start, status),
    CONSTRAINT fk_attendance_week_signatures_class
        FOREIGN KEY (class_id) REFERENCES classes(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_attendance_week_signatures_teacher
        FOREIGN KEY (teacher_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_attendance_week_signatures_invalidated_by
        FOREIGN KEY (invalidated_by) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attendance_week_submissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    class_id BIGINT UNSIGNED NOT NULL,
    week_start DATE NOT NULL,
    received_by BIGINT UNSIGNED NOT NULL,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_attendance_week_submissions_class_week (class_id, week_start),
    KEY idx_attendance_week_submissions_received_by (received_by, received_at),
    CONSTRAINT fk_attendance_week_submissions_class
        FOREIGN KEY (class_id) REFERENCES classes(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_attendance_week_submissions_receiver
        FOREIGN KEY (received_by) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;
