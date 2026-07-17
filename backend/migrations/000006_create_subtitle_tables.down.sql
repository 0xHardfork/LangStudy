DROP TABLE IF EXISTS subtitle_sentences;
DROP TABLE IF EXISTS subtitle_blocks;
DROP TABLE IF EXISTS subtitle_topics;

ALTER TABLE llm_configs DROP COLUMN IF EXISTS subtitle_translate_prompt_tpl;
ALTER TABLE llm_configs DROP COLUMN IF EXISTS subtitle_analyze_prompt_tpl;
