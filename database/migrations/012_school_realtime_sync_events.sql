-- Realtime change notifications are school-scoped and contain no business data.
-- Apply once after migration 011; this does not modify existing school records.
CREATE TABLE IF NOT EXISTS school_sync_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    school_id BIGINT UNSIGNED NOT NULL,
    event_type VARCHAR(40) NOT NULL DEFAULT 'data.changed',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_school_sync_events_school_id (school_id, id),
    KEY idx_school_sync_events_created_at (created_at),
    CONSTRAINT fk_school_sync_events_school
        FOREIGN KEY (school_id) REFERENCES schools(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
