CREATE TABLE IF NOT EXISTS dialogues (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language    VARCHAR(20) NOT NULL,
    level       VARCHAR(20) NOT NULL,
    topic       VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dialogue_lines (
    id            BIGSERIAL PRIMARY KEY,
    dialogue_id   BIGINT NOT NULL REFERENCES dialogues(id) ON DELETE CASCADE,
    line_index    INT NOT NULL,
    speaker       VARCHAR(10) NOT NULL,   -- "A" or "B"
    original_text TEXT NOT NULL,
    translation   TEXT NOT NULL,
    audio_path    TEXT,                   -- 相对路径，如 static/audio/1/0.mp3，生成失败时为 NULL
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vocabulary_items (
    id               BIGSERIAL PRIMARY KEY,
    dialogue_line_id BIGINT NOT NULL REFERENCES dialogue_lines(id) ON DELETE CASCADE,
    word             TEXT NOT NULL,
    word_index       INT NOT NULL,
    importance       SMALLINT NOT NULL CHECK (importance BETWEEN 1 AND 4),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ebbinghaus_reviews (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dialogue_line_id BIGINT NOT NULL REFERENCES dialogue_lines(id) ON DELETE CASCADE,
    next_review_at   TIMESTAMPTZ NOT NULL,
    review_count     INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, dialogue_line_id)
);

CREATE INDEX IF NOT EXISTS idx_dialogue_lines_dialogue_id ON dialogue_lines(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_items_line_id   ON vocabulary_items(dialogue_line_id);
CREATE INDEX IF NOT EXISTS idx_ebbinghaus_user_next       ON ebbinghaus_reviews(user_id, next_review_at);
