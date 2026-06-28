CREATE TABLE IF NOT EXISTS grammar_articles (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    raw_text    TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grammar_sentences (
    id             BIGSERIAL PRIMARY KEY,
    article_id     BIGINT NOT NULL REFERENCES grammar_articles(id) ON DELETE CASCADE,
    sentence_index INT NOT NULL,
    original_text  TEXT NOT NULL,
    translation    TEXT NOT NULL,
    explanation    TEXT NOT NULL,
    audio_path     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grammar_quizzes (
    id             BIGSERIAL PRIMARY KEY,
    sentence_id    BIGINT NOT NULL REFERENCES grammar_sentences(id) ON DELETE CASCADE,
    question       TEXT NOT NULL,
    options        JSONB NOT NULL,
    correct_option INT NOT NULL,
    explanations   JSONB NOT NULL,
    tags           TEXT[] DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grammar_reviews (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grammar_quiz_id BIGINT NOT NULL REFERENCES grammar_quizzes(id) ON DELETE CASCADE,
    next_review_at  TIMESTAMPTZ NOT NULL,
    review_count    INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, grammar_quiz_id)
);

CREATE INDEX IF NOT EXISTS idx_grammar_sentences_article ON grammar_sentences(article_id);
CREATE INDEX IF NOT EXISTS idx_grammar_quizzes_sentence   ON grammar_quizzes(sentence_id);
CREATE INDEX IF NOT EXISTS idx_grammar_reviews_user_next ON grammar_reviews(user_id, next_review_at);
