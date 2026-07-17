ALTER TABLE subtitle_topics ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_subtitle_topics_shared ON subtitle_topics(is_shared) WHERE is_shared = TRUE;
