import type { Dialogue, DialogueType, DialogueWithProgress, ReviewItem, UserLearningProfile, GrammarArticle, GrammarQuizReviewDetail, GrammarSentence, AuthUser, ReadingArticle, ReadingSentence, SubtitleTopic, SubtitleSentence } from '../types'

const BASE = '/api/v1'

// ─── Generic helper ────────────────────────────────────────────────────────

async function apiCall<T>(_token: string | null | undefined, path: string, options?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(_token ? { 'Authorization': `Bearer ${_token}` } : {}),
        ...(options?.headers ?? {}),
      },
    })
  } catch {
    throw new Error('网络请求失败，请检查网络连接')
  }

  // Intercept 401 and try to refresh token (exclude login, register, and refresh endpoints)
  if (res.status === 401 && path !== '/login' && path !== '/register' && path !== '/refresh') {
    try {
      const refreshRes = await fetch(`${BASE}/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (refreshRes.ok) {
        // Retry the original request with the newly set access token cookie
        res = await fetch(`${BASE}${path}`, {
          ...options,
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            ...(_token ? { 'Authorization': `Bearer ${_token}` } : {}),
            ...(options?.headers ?? {}),
          },
        })
      }
    } catch {
      // Ignore exception and fall through to standard error handling
    }
  }

  const json = await res.json()
  if (json.code !== 0) {
    throw new Error(json.msg || '服务器内部出错')
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

export function changePassword(
  token: string,
  payload: { old_password: string; new_password: string },
): Promise<{ ok: boolean }> {
  return apiCall<{ ok: boolean }>(token, '/me/password', {
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

export interface ListDialoguesResult {
  items: Dialogue[]
  total: number
  page: number
  page_size: number
}

export function listDialogues(
  token: string,
  page: number = 1,
  pageSize: number = 10,
  search?: string
): Promise<ListDialoguesResult> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  if (search) {
    params.append('search', search)
  }
  return apiCall<ListDialoguesResult>(token, `/dialogue?${params.toString()}`)
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

export function rejectDialogue(token: string, dialogueId: number): Promise<{ ok: boolean }> {
  return apiCall<{ ok: boolean }>(token, `/dialogue/${dialogueId}/reject`, {
    method: 'POST',
  })
}

// ─── Reading ───────────────────────────────────────────────────────────────

export function createReadingArticle(token: string, title: string, text: string): Promise<ReadingArticle> {
  return apiCall<ReadingArticle>(token, '/reading/analyze', {
    method: 'POST',
    body: JSON.stringify({ title, text }),
  })
}

export function getReadingHistory(token: string): Promise<ReadingArticle[]> {
  return apiCall<ReadingArticle[]>(token, '/reading/history')
}

export function getReadingArticle(token: string, id: number): Promise<ReadingArticle> {
  return apiCall<ReadingArticle>(token, `/reading/article/${id}`)
}

export function regenerateReadingSentence(token: string, sentenceId: number): Promise<ReadingSentence> {
  return apiCall<ReadingSentence>(token, `/reading/sentence/${sentenceId}/regenerate`, {
    method: 'POST',
  })
}

export function addReadingSentence(token: string, articleId: number, text: string): Promise<ReadingArticle> {
  return apiCall<ReadingArticle>(token, `/reading/article/${articleId}/sentence`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

// ─── Subtitle ──────────────────────────────────────────────────────────────

export async function uploadSubtitle(
  token: string,
  file: File,
  title: string,
  targetLang: string,
  nativeLang: string
): Promise<SubtitleTopic> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('title', title)
  formData.append('target_language', targetLang)
  formData.append('native_language', nativeLang)

  const res = await fetch(`${BASE}/subtitle/upload`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  })

  const json = await res.json()
  if (json.code !== 0) {
    throw new Error(json.msg || '服务器内部出错')
  }
  return json.data as SubtitleTopic
}

export function getSubtitleHistory(token: string): Promise<SubtitleTopic[]> {
  return apiCall<SubtitleTopic[]>(token, '/subtitle/history')
}

export function getSubtitleTopic(token: string, id: number): Promise<SubtitleTopic> {
  return apiCall<SubtitleTopic>(token, `/subtitle/topic/${id}`)
}

export function regenerateSubtitleSentence(token: string, sentenceId: number): Promise<SubtitleSentence> {
  return apiCall<SubtitleSentence>(token, `/subtitle/sentence/${sentenceId}/regenerate`, {
    method: 'POST',
  })
}

export function deleteSubtitleTopic(token: string, id: number): Promise<void> {
  return apiCall<void>(token, `/subtitle/topic/${id}`, {
    method: 'DELETE',
  })
}

export function processSubtitleChunk(token: string, chunkId: number): Promise<{ ok: boolean }> {
  return apiCall<{ ok: boolean }>(token, `/subtitle/chunk/${chunkId}/process`, {
    method: 'POST',
  })
}

export function processSubtitleTopic(token: string, topicId: number): Promise<{ ok: boolean }> {
  return apiCall<{ ok: boolean }>(token, `/subtitle/topic/${topicId}/process`, {
    method: 'POST',
  })
}

export function mergeSubtitleTopic(token: string, topicId: number): Promise<{ ok: boolean }> {
  return apiCall<{ ok: boolean }>(token, `/subtitle/topic/${topicId}/merge`, {
    method: 'POST',
  })
}

export function shareSubtitleTopic(token: string, topicId: number): Promise<{ ok: boolean }> {
  return apiCall<{ ok: boolean }>(token, `/subtitle/topic/${topicId}/share`, {
    method: 'POST',
  })
}

export function unshareSubtitleTopic(token: string, topicId: number): Promise<{ ok: boolean }> {
  return apiCall<{ ok: boolean }>(token, `/subtitle/topic/${topicId}/unshare`, {
    method: 'POST',
  })
}

export function getSharedSubtitles(token: string): Promise<SubtitleTopic[]> {
  return apiCall<SubtitleTopic[]>(token, '/subtitle/shared')
}


