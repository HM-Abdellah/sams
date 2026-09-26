-- SAMS migration 005: whole-school Excel import staging.
--
-- One uploaded workbook can contain many class blocks and many students.
-- This staging schema deliberately stays separate from the legacy class-scoped
-- student_import_* tables until the new importer is fully verified.

USE sams;

CREATE TABLE school_import_batches (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    created_by BIGINT UNSIGNED NOT NULL,
    target_academic_year_id BIGINT UNSIGNED NULL,
    source_academic_year VARCHAR(40) NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_sha256 CHAR(64) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    status ENUM('staged', 'validated', 'imported', 'failed') NOT NULL DEFAULT 'staged',
    total_classes INT UNSIGNED NOT NULL DEFAULT 0,
    valid_classes INT UNSIGNED NOT NULL DEFAULT 0,
    warning_classes INT UNSIGNED NOT NULL DEFAULT 0,
    error_classes INT UNSIGNED NOT NULL DEFAULT 0,
    total_rows INT UNSIGNED NOT NULL DEFAULT 0,
    valid_rows INT UNSIGNED NOT NULL DEFAULT 0,
    warning_rows INT UNSIGNED NOT NULL DEFAULT 0,
    error_rows INT UNSIGNED NOT NULL DEFAULT 0,
    imported_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_school_import_batches_created (created_at),
    KEY idx_school_import_batches_status (status, created_at),
    KEY idx_school_import_batches_hash (file_sha256),
    CONSTRAINT fk_school_import_batches_creator
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_school_import_batches_target_year
        FOREIGN KEY (target_academic_year_id) REFERENCES academic_years(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE school_import_classes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    batch_id BIGINT UNSIGNED NOT NULL,
    source_sheet VARCHAR(255) NOT NULL,
    source_block_start_row INT UNSIGNED NOT NULL,
    source_block_end_row INT UNSIGNED NULL,
    source_class_name VARCHAR(100) NULL,
    source_level VARCHAR(100) NULL,
    source_academic_year VARCHAR(40) NULL,
    target_class_id BIGINT UNSIGNED NULL,
    status ENUM('valid', 'warning', 'error', 'mapped', 'imported') NOT NULL DEFAULT 'valid',
    student_count INT UNSIGNED NOT NULL DEFAULT 0,
    issues JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_school_import_class_source (batch_id, source_sheet, source_block_start_row),
    KEY idx_school_import_classes_batch_status (batch_id, status),
    KEY idx_school_import_classes_target (target_class_id),
    CONSTRAINT fk_school_import_classes_batch
        FOREIGN KEY (batch_id) REFERENCES school_import_batches(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_school_import_classes_target
        FOREIGN KEY (target_class_id) REFERENCES classes(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE school_import_rows (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    import_class_id BIGINT UNSIGNED NOT NULL,
    source_row INT UNSIGNED NOT NULL,
    roster_number VARCHAR(30) NULL,
    first_name VARCHAR(80) NULL,
    last_name VARCHAR(80) NULL,
    massar_code VARCHAR(32) NULL,
    birth_date DATE NULL,
    sex VARCHAR(30) NULL,
    birth_place VARCHAR(120) NULL,
    status ENUM('valid', 'warning', 'error', 'matched', 'imported') NOT NULL DEFAULT 'error',
    match_status ENUM('not_checked', 'new', 'existing', 'conflict') NOT NULL DEFAULT 'not_checked',
    issues JSON NULL,
    matched_student_id BIGINT UNSIGNED NULL,
    target_enrollment_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_school_import_rows_source (import_class_id, source_row),
    KEY idx_school_import_rows_class_status (import_class_id, status),
    KEY idx_school_import_rows_massar (massar_code),
    KEY idx_school_import_rows_match (match_status),
    KEY idx_school_import_rows_student (matched_student_id),
    KEY idx_school_import_rows_enrollment (target_enrollment_id),
    CONSTRAINT fk_school_import_rows_class
        FOREIGN KEY (import_class_id) REFERENCES school_import_classes(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_school_import_rows_student
        FOREIGN KEY (matched_student_id) REFERENCES students(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_school_import_rows_enrollment
        FOREIGN KEY (target_enrollment_id) REFERENCES student_enrollments(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;
