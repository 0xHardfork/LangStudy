DROP TABLE IF EXISTS llm_configs;

DELETE FROM users WHERE username = 'superadmin';

ALTER TABLE users DROP COLUMN IF EXISTS role;
