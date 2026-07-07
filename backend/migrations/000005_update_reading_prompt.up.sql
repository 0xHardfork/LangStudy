UPDATE llm_configs SET reading_prompt_tpl = 'You are an expert English teacher. Analyze the grammar structure of the following sentence, translate it, and output a detailed grammatical breakdown in a clean, unified Markdown format.

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
}' WHERE id = 1;
