CREATE TABLE IF NOT EXISTS users (
    id         BIGSERIAL PRIMARY KEY,
    username   VARCHAR(64)  NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    role       VARCHAR(20)  NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    nickname        VARCHAR(64) NOT NULL DEFAULT '',
    native_language VARCHAR(20) NOT NULL DEFAULT 'zh',
    target_languages JSONB NOT NULL DEFAULT '[]',
    fill_blank_level INT NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS llm_configs (
    id                 SERIAL PRIMARY KEY,
    api_url            VARCHAR(255) NOT NULL,
    api_key            VARCHAR(255) NOT NULL,
    model_name         VARCHAR(100) NOT NULL,
    prompt_tpl         TEXT NOT NULL,
    vocab_prompt_tpl   TEXT NOT NULL DEFAULT '',
    grammar_prompt_tpl TEXT NOT NULL DEFAULT '',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dialogue_types (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT         NOT NULL DEFAULT '',
    emoji       VARCHAR(10)  NOT NULL DEFAULT '💬',
    sort_order  INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dialogues (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language    VARCHAR(20) NOT NULL,
    level       VARCHAR(20) NOT NULL,
    topic       VARCHAR(100) NOT NULL,
    is_rejected BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dialogue_lines (
    id            BIGSERIAL PRIMARY KEY,
    dialogue_id   BIGINT NOT NULL REFERENCES dialogues(id) ON DELETE CASCADE,
    line_index    INT NOT NULL,
    speaker       VARCHAR(10) NOT NULL,
    original_text TEXT NOT NULL,
    translation   TEXT NOT NULL,
    audio_path    TEXT,
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

CREATE INDEX IF NOT EXISTS idx_dialogue_lines_dialogue_id ON dialogue_lines(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_items_line_id   ON vocabulary_items(dialogue_line_id);
CREATE INDEX IF NOT EXISTS idx_ebbinghaus_user_next       ON ebbinghaus_reviews(user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_shared_dialogues_lookup    ON shared_dialogues(topic, language, level);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_updated ON user_dialogue_progress(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_grammar_sentences_article ON grammar_sentences(article_id);
CREATE INDEX IF NOT EXISTS idx_grammar_quizzes_sentence   ON grammar_quizzes(sentence_id);
CREATE INDEX IF NOT EXISTS idx_grammar_reviews_user_next  ON grammar_reviews(user_id, next_review_at);
