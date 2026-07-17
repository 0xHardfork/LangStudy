CREATE TABLE IF NOT EXISTS subtitle_topics (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title                VARCHAR(255) NOT NULL,
    original_file_name   VARCHAR(255) NOT NULL,
    native_language      VARCHAR(20) NOT NULL DEFAULT 'zh',
    target_language      VARCHAR(20) NOT NULL DEFAULT 'en',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subtitle_blocks (
    id          BIGSERIAL PRIMARY KEY,
    topic_id    BIGINT NOT NULL REFERENCES subtitle_topics(id) ON DELETE CASCADE,
    block_index INT NOT NULL,
    start_time  VARCHAR(50) NOT NULL,
    end_time    VARCHAR(50) NOT NULL,
    raw_text    TEXT NOT NULL,
    target_text TEXT NOT NULL,
    native_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subtitle_sentences (
    id             BIGSERIAL PRIMARY KEY,
    topic_id       BIGINT NOT NULL REFERENCES subtitle_topics(id) ON DELETE CASCADE,
    sentence_index INT NOT NULL,
    original_text  TEXT NOT NULL,
    translation    TEXT NOT NULL,
    explanation    TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subtitle_blocks_topic ON subtitle_blocks(topic_id);
CREATE INDEX IF NOT EXISTS idx_subtitle_sentences_topic ON subtitle_sentences(topic_id);

ALTER TABLE llm_configs ADD COLUMN IF NOT EXISTS subtitle_translate_prompt_tpl TEXT NOT NULL DEFAULT '';
ALTER TABLE llm_configs ADD COLUMN IF NOT EXISTS subtitle_analyze_prompt_tpl TEXT NOT NULL DEFAULT '';

UPDATE llm_configs SET 
  subtitle_translate_prompt_tpl = 'You are a professional subtitle translator. Translate the following video subtitle blocks from a learning context. For each block, translate its "text" into the target learning language "{{target_lang}}" (if not already in it) and the native language "{{native_lang}}".
Input blocks (JSON format):
{{blocks}}

You MUST return a JSON array containing ONLY objects with this exact structure:
[
  {
    "index": <block index>,
    "target_text": "<translation in {{target_lang}}>",
    "native_text": "<translation in {{native_lang}}>"
  }
]',
  subtitle_analyze_prompt_tpl = 'You are an expert English teacher. Analyze the grammar structure of the following sentence from a video subtitle, translate it, and output a detailed grammatical breakdown in a clean, unified Markdown format.

Sentence: "{{sentence}}"

Generate a JSON object strictly matching this schema:
{
  "translation": "accurate Chinese translation of the sentence",
  "explanation": "Detailed grammatical analysis of the sentence structure. You MUST use this exact Markdown template for the explanation:

### 1. 句子主干 (Core Structure)
- **主语 (Subject):** [Explain what the subject is]
- **谓语 (Predicate):** [Explain the verb/predicate]
- **宾语/表语 (Object/Predicative):** [Explain the object or predicative]

### 2. 语法点解析 (Grammar Points)
- **[Point Name 1]**: [Detail analysis of clauses, modifiers, voice, tenses, etc.]
- **[Point Name 2]**: [Detail analysis of another syntax rule applied here]

### 3. 词汇与搭配 (Vocabulary & Phrases)
- **[Word/Phrase 1]**: [Chinese meaning and context explanation]
- **[Word/Phrase 2]**: [Chinese meaning and context explanation]"
}'
WHERE id = 1;
