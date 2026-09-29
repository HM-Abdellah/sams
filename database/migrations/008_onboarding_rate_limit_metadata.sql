-- SAMS migration 008: persist minimal HTTP metadata required for onboarding rate limiting.

USE sams;

ALTER TABLE teacher_onboarding_requests
    ADD COLUMN request_ip VARCHAR(45) NULL AFTER phone,
    ADD COLUMN request_user_agent VARCHAR(512) NULL AFTER request_ip,
    ADD KEY idx_teacher_onboarding_rate_limit (request_ip, created_at, school_id);
