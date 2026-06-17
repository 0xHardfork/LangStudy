// ─── Auth & User ───────────────────────────────────────────────────────────

export interface AuthUser {
  id: number
  username: string
  role: string
  created_at: string
}

// ─── Learning Profile ──────────────────────────────────────────────────────

export interface TargetLanguage {
  lang: string   // "ja" | "en" | "ko" | "fr" | "de" | "es"
  level: string  // "beginner" | "intermediate" | "advanced"
}

export interface UserLearningProfile {
  id?: number
  user_id?: number
  nickname: string
  native_language: string
  target_languages: TargetLanguage[]
}

// ─── Dialogue ──────────────────────────────────────────────────────────────

export interface VocabularyItem {
  id: number
  dialogue_line_id: number
  word: string
  word_index: number
  importance: number  // 1-4
}

export interface DialogueLine {
  id: number
  dialogue_id: number
  line_index: number
  speaker: string       // "A" | "B"
  original_text: string
  translation: string
  audio_path: string | null  // e.g. "static/audio/1/0.mp3"
  vocabulary: VocabularyItem[]
}

export interface Dialogue {
  id: number
  user_id: number
  language: string
  level: string
  topic: string
  lines: DialogueLine[]
  created_at: string
}

// ─── Review ────────────────────────────────────────────────────────────────

export interface ReviewItem {
  id: number
  dialogue_line_id: number
  original_text: string
  translation: string
  audio_path: string | null
  next_review_at: string
  review_count: number
}

// ─── Constants ─────────────────────────────────────────────────────────────

export const LANGUAGE_LABELS: Record<string, string> = {
  ja: '日语',
  en: '英语',
  ko: '韩语',
  fr: '法语',
  de: '德语',
  es: '西班牙语',
}

export const LANGUAGE_FLAGS: Record<string, string> = {
  ja: '🇯🇵',
  en: '🇺🇸',
  ko: '🇰🇷',
  fr: '🇫🇷',
  de: '🇩🇪',
  es: '🇪🇸',
}

export const LEVEL_LABELS: Record<string, string> = {
  beginner: '初级',
  intermediate: '中级',
  advanced: '高级',
}

export const DIALOGUE_TOPICS = [
  'SDL', 'Incident', '购物', '餐厅点餐', '职场沟通', '健康与医疗', '兴趣爱好',
  'k8s-security', 'DevSevOps', 'Web3-Security',
]

export const TOPIC_EMOJIS: Record<string, string> = {
  'SDL': '🛡️',
  'Incident': '🚨',
  '购物': '🛍️',
  '餐厅点餐': '🍜',
  '职场沟通': '💼',
  '健康与医疗': '🏥',
  '兴趣爱好': '🎨',
  'k8s-security': '☸️',
  'DevSevOps': '🔧',
  'Web3-Security': '⛓️',
}
