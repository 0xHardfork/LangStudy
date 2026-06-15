ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';

INSERT INTO users (username, password, role)
VALUES ('superadmin', '$2a$10$bVA4RbstSXN2BrK/2r//zevvc6gSOhI80wiTksRFJKJSjl8lY8/s.', 'admin')
ON CONFLICT (username) DO UPDATE SET role = 'admin';

CREATE TABLE IF NOT EXISTS llm_configs (
    id         SERIAL PRIMARY KEY,
    api_url    VARCHAR(255) NOT NULL,
    api_key    VARCHAR(255) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    prompt_tpl TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO llm_configs (api_url, api_key, model_name, prompt_tpl)
VALUES ('https://api.openai.com/v1', 'sk-placeholder', 'gpt-4o', 'Generate a dialogue for language learning with level {{.Level}}.');
