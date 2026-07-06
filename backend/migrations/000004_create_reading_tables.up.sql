CREATE TABLE IF NOT EXISTS reading_articles (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    raw_text    TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reading_sentences (
    id              BIGSERIAL PRIMARY KEY,
    article_id      BIGINT NOT NULL REFERENCES reading_articles(id) ON DELETE CASCADE,
    sentence_index  INT NOT NULL,
    paragraph_index INT NOT NULL DEFAULT 0,
    original_text   TEXT NOT NULL,
    translation     TEXT NOT NULL,
    explanation     TEXT NOT NULL,
    audio_path      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reading_sentences_article ON reading_sentences(article_id);
