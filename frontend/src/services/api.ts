import type { Dialogue, DialogueType, ReviewItem, UserLearningProfile } from '../types'

const BASE = '/api/v1'

// ─── Generic helper ────────────────────────────────────────────────────────

async function apiCall<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  })
  const json = await res.json()
  if (json.code !== 0) throw new Error(json.msg ?? 'API error')
  return json.data as T
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

export function submitAnswer(
  token: string,
  payload: { dialogue_line_id: number; is_correct: boolean },
): Promise<void> {
  return apiCall<void>(token, '/reviews/answer', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
