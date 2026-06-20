DROP TABLE IF EXISTS user_dialogue_progress;
DROP TABLE IF EXISTS shared_dialogues;
ALTER TABLE dialogues DROP COLUMN IF EXISTS is_rejected;
