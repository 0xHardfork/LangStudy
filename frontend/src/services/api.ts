import type { Dialogue, DialogueType, DialogueWithProgress, ReviewItem, UserLearningProfile, GrammarArticle, GrammarQuizReviewDetail, GrammarSentence, AuthUser } from '../types'

const BASE = '/api/v1'

// ─── Generic helper ────────────────────────────────────────────────────────

async function apiCall<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  console.log("[apiCall]", path, "token:", token ? token.substring(0, 10) + "..." : "null")
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options?.headers ?? {}),
      },
    })
  } catch {
    throw new Error('网络请求失败，请检查网络连接')
  }
  const json = await res.json()
  if (json.code !== 0) {
    // Avoid leaking internal server error details to the UI
    if (res.status >= 500) throw new Error('服务器出错，请稍后重试')
    throw new Error(json.msg ?? 'API error')
  }
  return json.data as T
}

// ─── Auth ─────────────────────────────────────────────────────────────────

export function getProfile(token: string): Promise<AuthUser> {
  return apiCall<AuthUser>(token, '/profile')
}

// ─── User Profile ──────────────────────────────────────────────────────────

export function getLearningProfile(token: string): Promise<UserLearningProfile> {
  return apiCall<UserLearningProfile>(token, '/me/profile')
}

export function upsertLearningProfile(
  token: string,
  payload: Omit<UserLearningProfile, 'id' | 'user_id'>,
): Promise<UserLearningProfile> {
  return apiCall<UserLearningProfile>(token, '/me/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

// ─── Dialogue ──────────────────────────────────────────────────────────────

export function getDialogueTypes(token: string): Promise<DialogueType[]> {
  return apiCall<DialogueType[]>(token, '/dialogue/types')
}

// Admin: dialogue types CRUD
export function adminListDialogueTypes(token: string): Promise<DialogueType[]> {
  return apiCall<DialogueType[]>(token, '/admin/dialogue-types')
}

export function adminCreateDialogueType(
  token: string,
  payload: { name: string; description: string; emoji: string; sort_order: number },
): Promise<DialogueType> {
  return apiCall<DialogueType>(token, '/admin/dialogue-types', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function adminUpdateDialogueType(
  token: string,
  id: number,
  payload: { name: string; description: string; emoji: string; sort_order: number },
): Promise<DialogueType> {
  return apiCall<DialogueType>(token, `/admin/dialogue-types/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function adminDeleteDialogueType(token: string, id: number): Promise<void> {
  return apiCall<void>(token, `/admin/dialogue-types/${id}`, { method: 'DELETE' })
}

export function generateDialogue(
  token: string,
  payload: { topic: string; language: string; level: string },
): Promise<Dialogue> {
  return apiCall<Dialogue>(token, '/dialogue/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getSharedDialogue(
  token: string,
  topic: string,
  language: string,
  level: string,
): Promise<DialogueWithProgress> {
  const params = new URLSearchParams({ topic, language, level })
  return apiCall<DialogueWithProgress>(token, `/dialogue/shared?${params.toString()}`)
}

export function getActiveDialogue(token: string): Promise<DialogueWithProgress> {
  return apiCall<DialogueWithProgress>(token, '/dialogue/active')
}

export function updateDialogueProgress(
  token: string,
  dialogueId: number,
  lineIndex: number,
  completed: boolean,
): Promise<void> {
  return apiCall<void>(token, `/dialogue/${dialogueId}/progress`, {
    method: 'PUT',
    body: JSON.stringify({ current_line_index: lineIndex, is_completed: completed }),
  })
}

export function regenerateDialogue(
  token: string,
  payload: {
    prev_dialogue_id: number
    topic: string
    language: string
    level: string
    hint: string
    native_language: string
  },
): Promise<Dialogue> {
  return apiCall<Dialogue>(token, '/dialogue/regenerate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getDialogue(token: string, id: number): Promise<Dialogue> {
  return apiCall<Dialogue>(token, `/dialogue/${id}`)
}

export function listDialogues(token: string): Promise<Dialogue[]> {
  return apiCall<Dialogue[]>(token, '/dialogue')
}

// ─── Reviews ───────────────────────────────────────────────────────────────

export function getDueReviews(token: string): Promise<ReviewItem[]> {
  return apiCall<ReviewItem[]>(token, '/reviews/due')
}

export function getReviewSchedule(token: string): Promise<ReviewItem[]> {
  return apiCall<ReviewItem[]>(token, '/reviews/schedule')
}

export function submitAnswer(
  token: string,
  payload: { dialogue_line_id: number; is_correct: boolean },
): Promise<void> {
  return apiCall<void>(token, '/reviews/answer', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ─── Grammar ───────────────────────────────────────────────────────────────

export function analyzeText(token: string, title: string, text: string): Promise<GrammarArticle> {
  return apiCall<GrammarArticle>(token, '/grammar/analyze', {
    method: 'POST',
    body: JSON.stringify({ title, text }),
  })
}

export function getGrammarHistory(token: string): Promise<GrammarArticle[]> {
  return apiCall<GrammarArticle[]>(token, '/grammar/history')
}

export function getAnalyzedArticle(token: string, id: number): Promise<GrammarArticle> {
  return apiCall<GrammarArticle>(token, `/grammar/article/${id}`)
}

export function submitGrammarAnswer(
  token: string,
  payload: { grammar_quiz_id: number; is_correct: boolean },
): Promise<void> {
  return apiCall<void>(token, '/grammar/quiz/answer', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getDueGrammarReviews(token: string): Promise<GrammarQuizReviewDetail[]> {
  return apiCall<GrammarQuizReviewDetail[]>(token, '/grammar/reviews/due')
}

export function regenerateGrammarSentence(token: string, sentenceId: number): Promise<GrammarSentence> {
  return apiCall<GrammarSentence>(token, `/grammar/sentence/${sentenceId}/regenerate`, {
    method: 'POST',
  })
}

