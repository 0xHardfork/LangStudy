CREATE TABLE IF NOT EXISTS subtitle_chunks (
    id            BIGSERIAL PRIMARY KEY,
    topic_id      BIGINT NOT NULL REFERENCES subtitle_topics(id) ON DELETE CASCADE,
    chunk_index   INT NOT NULL,
    start_index   INT NOT NULL,
    end_index     INT NOT NULL,
    raw_content   TEXT NOT NULL,
    status        VARCHAR(50) NOT NULL DEFAULT 'pending',
    error_message TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subtitle_chunks_topic ON subtitle_chunks(topic_id);

ALTER TABLE subtitle_topics ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending';
