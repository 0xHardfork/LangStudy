UPDATE llm_configs SET reading_prompt_tpl = 'You are an expert English teacher. Analyze the grammar structure of the following sentence and translate it.

Sentence: "{{sentence}}"

Generate a JSON object strictly matching this schema:
{
  "translation": "accurate Chinese translation of the sentence",
  "explanation": "Detailed grammatical analysis of the sentence structure (Subject, Verb, Object, Clauses, Modifiers, etc.) and explanations of the syntax rules used."
}' WHERE id = 1;
