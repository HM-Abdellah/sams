[Reading 17 lines from start (total: 17 lines, 0 remaining)]

-- Phase 38: server-authoritative attendance lesson revisions.
CREATE TABLE IF NOT EXISTS attendance_register_revisions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    class_id BIGINT UNSIGNED NOT NULL,
    attendance_date DATE NOT NULL,
    period TINYINT UNSIGNED NOT NULL,
    revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_attendance_register_revisions_class_date_period (class_id, attendance_date, period),
    KEY idx_attendance_register_revisions_class_date (class_id, attendance_date),
    CONSTRAINT fk_attendance_register_revisions_class
        FOREIGN KEY (class_id) REFERENCES classes(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT chk_attendance_register_revisions_period CHECK (period BETWEEN 1 AND 8)
) ENGINE=InnoDB;

[executed on device: codespaces-052ecf (81686ebc-c2a3-4f3f-931c-1c91ab9990de)]