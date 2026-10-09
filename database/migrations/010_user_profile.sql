-- Profile settings: safe user profile image storage metadata.
ALTER TABLE users
    ADD COLUMN avatar_path VARCHAR(255) NULL AFTER full_name,
    ADD KEY idx_users_avatar_path (avatar_path);

