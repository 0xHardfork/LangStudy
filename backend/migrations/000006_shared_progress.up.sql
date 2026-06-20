ALTER TABLE dialogues ADD COLUMN IF NOT EXISTS is_rejected BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS shared_dialogues (
    id          BIGSERIAL PRIMARY KEY,
    topic       VARCHAR(100) NOT NULL,
    language    VARCHAR(20)  NOT NULL,
    level       VARCHAR(20)  NOT NULL,
    dialogue_id BIGINT       NOT NULL REFERENCES dialogues(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(topic, language, level)
);

CREATE TABLE IF NOT EXISTS user_dialogue_progress (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            BIGINT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dialogue_id        BIGINT  NOT NULL REFERENCES dialogues(id) ON DELETE CASCADE,
    current_line_index INT     NOT NULL DEFAULT 0,
    is_completed       BOOLEAN NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, dialogue_id)
);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_updated ON user_dialogue_progress(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_dialogues_lookup    ON shared_dialogues(topic, language, level);
