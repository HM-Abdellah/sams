-- SAMS migration 003: preserve class history for students and attendance.
--
-- Existing attendance rows are associated with the student's current class during
-- migration. This is lossless for installations that have not performed class
-- transfers before this migration. If transfers already happened, reconcile those
-- rows before applying migration 003.

USE sams;

CREATE TABLE student_enrollments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    student_id BIGINT UNSIGNED NOT NULL,
    class_id BIGINT UNSIGNED NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_enrollments_student_start (student_id, starts_on),
    UNIQUE KEY uq_enrollments_id_student (id, student_id),
    KEY idx_enrollments_class_dates (class_id, starts_on, ends_on),
    KEY idx_enrollments_student_dates (student_id, starts_on, ends_on),
    CONSTRAINT fk_enrollments_student
        FOREIGN KEY (student_id) REFERENCES students(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_enrollments_class
        FOREIGN KEY (class_id) REFERENCES classes(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_enrollment_dates
        CHECK (ends_on IS NULL OR starts_on <= ends_on)
) ENGINE=InnoDB;

INSERT INTO student_enrollments (student_id, class_id, starts_on, ends_on)
SELECT
    s.id,
    s.class_id,
    ay.starts_on,
    NULL
FROM students s
INNER JOIN classes c ON c.id = s.class_id
INNER JOIN academic_years ay ON ay.id = c.academic_year_id
WHERE NOT EXISTS (
    SELECT 1
    FROM student_enrollments e
    WHERE e.student_id = s.id
      AND e.class_id = s.class_id
);

ALTER TABLE attendance
    ADD COLUMN enrollment_id BIGINT UNSIGNED NULL AFTER student_id;

UPDATE attendance a
INNER JOIN students s ON s.id = a.student_id
INNER JOIN student_enrollments e
    ON e.student_id = a.student_id
   AND e.class_id = s.class_id
   AND a.attendance_date >= e.starts_on
   AND (e.ends_on IS NULL OR a.attendance_date <= e.ends_on)
SET a.enrollment_id = e.id;

ALTER TABLE attendance
    MODIFY COLUMN enrollment_id BIGINT UNSIGNED NOT NULL;

ALTER TABLE attendance
    DROP INDEX uq_attendance_student_date_period,
    ADD UNIQUE KEY uq_attendance_enrollment_student_date_period
        (enrollment_id, student_id, attendance_date, period),
    ADD KEY idx_attendance_enrollment_date (enrollment_id, attendance_date),
    ADD CONSTRAINT fk_attendance_enrollment_student
        FOREIGN KEY (enrollment_id, student_id)
        REFERENCES student_enrollments(id, student_id)
        ON UPDATE CASCADE ON DELETE RESTRICT;
