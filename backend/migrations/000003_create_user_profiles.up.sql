CREATE TABLE IF NOT EXISTS user_profiles (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    nickname        VARCHAR(64) NOT NULL DEFAULT '',
    native_language VARCHAR(20) NOT NULL DEFAULT 'zh',
    -- 格式: [{"lang":"ja","level":"beginner"},{"lang":"en","level":"intermediate"}]
    target_languages JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
