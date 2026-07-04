-- Seed User (superadmin)
INSERT INTO users (username, password, role, is_approved)
VALUES ('superadmin', '$2a$10$bVA4RbstSXN2BrK/2r//zevvc6gSOhI80wiTksRFJKJSjl8lY8/s.', 'admin', true)
ON CONFLICT (username) DO UPDATE SET role = 'admin', is_approved = true;

-- Seed LLM Config
INSERT INTO llm_configs (id, api_url, api_key, model_name, prompt_tpl, vocab_prompt_tpl, grammar_prompt_tpl)
VALUES (1, 'https://api.openai.com/v1', 'sk-placeholder', 'gpt-4o', 
    'Generate a natural dialogue in {{language}} about the topic "{{topic}}".{{topic_description}}

The target learner''s level is: {{level}}. Adjust the language difficulty strictly according to these guidelines:
1. If level is "beginner": Use simple vocabulary, basic daily words, simple sentence structures (S-V-O), short sentences, and primarily present tense. Avoid complex grammar or idioms.
2. If level is "intermediate": Use common vocabulary, standard everyday expressions, compound/complex sentences (e.g., using "although", "because", "who", "which"), and a mix of tenses.
3. If level is "advanced": Use rich vocabulary, idiomatic expressions, complex syntactic structures (e.g., inversion, conditional, subjunctive), longer sentences, and native-like phrasing.

The dialogue should have exactly 16 lines, alternating between speaker A (female) and speaker B (male).
Return ONLY a JSON array with no other text, in this exact format:
[{"speaker":"A","original_text":"<text in {{language}}>","translation":"<Chinese translation>"},...]',
    'Given these dialogue lines (indexed 0 to {{max_line_index}}):
{{lines_json}}

For each line, identify the top 3 most important vocabulary words for language learners.
Rate each word''s importance from 1 (most important) to 4 (least important).
Word index is the 0-based position of the word when the sentence is split by spaces (or by character for non-space languages).
Return ONLY a JSON array with no other text:
[{"line_index":0,"word":"<word>","word_index":0,"importance":1},...]',
    'You are an expert English grammar teacher. Analyze the grammar structure of the following sentence and generate Cloze multiple-choice questions testing key grammar points.

Sentence: "{{sentence}}"

Generate a JSON object strictly matching this schema:
{
  "translation": "accurate Chinese translation of the sentence",
  "explanation": "Detailed grammatical analysis of the sentence structure (Subject, Verb, Object, Clauses, Modifiers, etc.) and explanations of the syntax rules used.",
  "quizzes": [
    {
      "question": "The sentence with the key grammar word/phrase replaced by ____ (e.g., ''The teacher who ____ us English has left the school.'')",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_option": 0,
      "tags": ["Grammar Concept Tag 1 (e.g. Attributive Clause)"],
      "explanations": {
        "0": "Pedagogical explanation of why Option A is correct or why it is a common incorrect trap.",
        "1": "Pedagogical explanation of why Option B is correct or why it is a common incorrect trap.",
        "2": "Pedagogical explanation of why Option C is correct or why it is a common incorrect trap.",
        "3": "Pedagogical explanation of why Option D is correct or why it is a common incorrect trap."
      }
    }
  ]
}

Guidelines:
1. Identify all key grammar points in the sentence. For each key grammar point identified, generate one multiple-choice Cloze question. The number of generated quizzes must equal the number of key grammar points.
2. Ensure the JSON output is valid and can be parsed directly. DO NOT put trailing commas (e.g., placing a comma after the last key-value pair in an object or array before the closing brace/bracket).
3. The Cloze question''s correct option must fill the blank ''____'' to reconstruct the original sentence exactly.
4. The other options (distractors) should represent typical grammatical mistakes made by ESL learners (e.g., wrong verb tense, incorrect pronoun, incorrect word form).
5. Provide clear, supportive explanations for both the correct answer and each incorrect option.')
ON CONFLICT (id) DO NOTHING;

-- Adjust standard PostgreSQL sequence for llm_configs to avoid auto-increment collision
SELECT setval(pg_get_serial_sequence('llm_configs', 'id'), COALESCE(max(id), 1)) FROM llm_configs;

-- Seed Dialogue Types
INSERT INTO dialogue_types (name, description, emoji, sort_order) VALUES
    ('SDL',         'Software Development Lifecycle discussions: requirements, design reviews, sprints, and release planning conversations between engineering team members.', '🛡️', 10),
    ('Incident',    'On-call incident response conversations: triaging alerts, identifying root cause, coordinating mitigation, and post-mortem debriefs.', '🚨', 20),
    ('购物',         '日常购物场景：询价、议价、退换货、结账等真实对话。', '🛍️', 30),
    ('餐厅点餐',     '餐厅就餐场景：点菜、询问食材、结账、与服务员的互动对话。', '🍜', 40),
    ('职场沟通',     '职场日常沟通：会议安排、任务协作、绩效讨论、跨团队沟通。', '💼', 50),
    ('健康与医疗',   '医疗就诊场景：挂号、与医生的问诊对话、药品询问、健康建议。', '🏥', 60),
    ('兴趣爱好',     '日常兴趣爱好话题：旅行、音乐、运动、电影等轻松休闲对话。', '🎨', 70),
    ('k8s-security','Kubernetes security topics: RBAC policies, pod security standards, network policies, admission controllers, and CVE discussions.', '☸️', 80),
    ('DevSevOps',   'DevSecOps pipeline conversations: CI/CD security gates, SAST/DAST integration, secrets management, and supply chain security.', '🔧', 90),
    ('Web3-Security','Web3 and blockchain security: smart contract auditing, reentrancy attacks, DeFi exploit discussions, and wallet security best practices.', '⛓️', 100)
ON CONFLICT (name) DO NOTHING;
