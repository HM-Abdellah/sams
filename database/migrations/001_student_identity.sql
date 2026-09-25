-- SAMS migration 001: strengthen the student identity model.
--
-- Existing student_number is retained for compatibility.
-- massar_code is globally unique when present; birth_date is optional during
-- migration so existing records can be completed before imports become strict.

USE sams;

ALTER TABLE students
    ADD COLUMN massar_code VARCHAR(32) NULL AFTER student_number,
    ADD COLUMN birth_date DATE NULL AFTER massar_code;

ALTER TABLE students
    ADD UNIQUE KEY uq_students_massar_code (massar_code),
    ADD KEY idx_students_birth_date (birth_date);
