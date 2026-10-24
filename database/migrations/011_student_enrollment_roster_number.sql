-- Persist a student's class-list / roster position per enrollment and academic year.
-- Apply once after migration 010; take and verify a database backup first.

ALTER TABLE student_enrollments
    ADD COLUMN roster_number VARCHAR(30) NULL AFTER class_id,
    ADD KEY idx_enrollments_class_roster (class_id, roster_number, student_id);

-- Recover roster positions already present in completed school imports.
-- If an enrollment appears in more than one imported workbook, use its latest batch.
UPDATE student_enrollments e
INNER JOIN (
    SELECT target_enrollment_id, roster_number
    FROM (
        SELECT
            r.target_enrollment_id,
            r.roster_number,
            ROW_NUMBER() OVER (
                PARTITION BY r.target_enrollment_id
                ORDER BY b.imported_at DESC, b.id DESC, r.updated_at DESC, r.id DESC
            ) AS recency_rank
        FROM school_import_rows r
        INNER JOIN school_import_classes c ON c.id = r.import_class_id
        INNER JOIN school_import_batches b ON b.id = c.batch_id
        WHERE b.status = 'imported'
          AND r.status = 'imported'
          AND r.target_enrollment_id IS NOT NULL
          AND r.roster_number IS NOT NULL
          AND TRIM(r.roster_number) <> ''
    ) ranked_imports
    WHERE recency_rank = 1
) imported_roster ON imported_roster.target_enrollment_id = e.id
SET e.roster_number = imported_roster.roster_number
WHERE e.roster_number IS NULL;
