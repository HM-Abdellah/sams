-- SAMS migration 004: staged student imports.
--
-- Import files are parsed and validated before any student row reaches the
-- production students table.

USE sams;

CREATE TABLE student_import_batches (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    class_id BIGINT UNSIGNED NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_sha256 CHAR(64) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    status ENUM('staged', 'validated', 'imported', 'failed') NOT NULL DEFAULT 'staged',
    total_rows INT UNSIGNED NOT NULL DEFAULT 0,
    valid_rows INT UNSIGNED NOT NULL DEFAULT 0,
    warning_rows INT UNSIGNED NOT NULL DEFAULT 0,
    error_rows INT UNSIGNED NOT NULL DEFAULT 0,
    imported_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_import_batches_hash_class (class_id, file_sha256),
    KEY idx_import_batches_class_created (class_id, created_at),
    KEY idx_import_batches_status (status, created_at),
    CONSTRAINT fk_import_batches_class
        FOREIGN KEY (class_id) REFERENCES classes(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_import_batches_creator
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE student_import_rows (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    batch_id BIGINT UNSIGNED NOT NULL,
    row_number INT UNSIGNED NOT NULL,
    first_name VARCHAR(80) NULL,
    last_name VARCHAR(80) NULL,
    massar_code VARCHAR(32) NULL,
    birth_date DATE NULL,
    student_number VARCHAR(30) NULL,
    status ENUM('valid', 'warning', 'error', 'imported') NOT NULL DEFAULT 'error',
    issues JSON NULL,
    raw_data JSON NULL,
    student_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_import_rows_batch_row (batch_id, row_number),
    KEY idx_import_rows_batch_status (batch_id, status),
    KEY idx_import_rows_student (student_id),
    CONSTRAINT fk_import_rows_batch
        FOREIGN KEY (batch_id) REFERENCES student_import_batches(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_import_rows_student
        FOREIGN KEY (student_id) REFERENCES students(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;
