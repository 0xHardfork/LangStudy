import { useState, useEffect } from 'react'
import { upsertLearningProfile } from '../services/api'
import type { UserLearningProfile } from '../types'
import { LANGUAGE_LABELS, LEVEL_LABELS } from '../types'

interface Props {
  token: string
  initialProfile: UserLearningProfile | null
  onSave: (updatedProfile: UserLearningProfile) => void
  onClose: () => void
}

const NATIVE_LANGUAGES = [
  { value: 'zh', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
]

export default function UserProfileModal({ token, initialProfile, onSave, onClose }: Props) {
  const [nickname, setNickname] = useState('')
  const [nativeLang, setNativeLang] = useState('zh')
  const [targetLang, setTargetLang] = useState('en')
  const [targetLevel, setTargetLevel] = useState('beginner')
  const [fillBlankLevel, setFillBlankLevel] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialProfile) {
      setNickname(initialProfile.nickname || '')
      setNativeLang(initialProfile.native_language || 'zh')
      if (initialProfile.target_languages && initialProfile.target_languages.length > 0) {
        setTargetLang(initialProfile.target_languages[0].lang)
        setTargetLevel(initialProfile.target_languages[0].level)
      }
      if (initialProfile.fill_blank_level) {
        setFillBlankLevel(initialProfile.fill_blank_level)
      }
    }
  }, [initialProfile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const payload = {
        nickname: nickname.trim(),
        native_language: nativeLang,
        target_languages: [
          {
            lang: targetLang,
            level: targetLevel,
          },
        ],
        fill_blank_level: fillBlankLevel,
      }
      const updated = await upsertLearningProfile(token, payload)
      onSave(updated)
      onClose()
    } catch (err: unknown) {
      setError((err as Error).message ?? '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(15,23,42,0.95)',
          border: '1px solid rgba(100,116,139,0.3)',
          borderRadius: '1.25rem',
          padding: '2rem',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.7)',
        }}
      >
        <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.25rem', marginBottom: '1.5rem' }}>
          个人设定
        </h2>

        {error && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: '0.8125rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              昵称
            </label>
            <input
              type="text"
              required
              maxLength={64}
              placeholder="请输入您的昵称"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              style={{
                width: '100%',
                borderRadius: '0.5rem',
                border: '1px solid rgba(100,116,139,0.3)',
                background: 'rgba(2,6,17,0.5)',
                padding: '0.625rem 0.875rem',
                color: 'white',
                fontSize: '0.875rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              母语
            </label>
            <select
              value={nativeLang}
              onChange={(e) => setNativeLang(e.target.value)}
              style={{
                width: '100%',
                borderRadius: '0.5rem',
                border: '1px solid rgba(100,116,139,0.3)',
                background: 'rgba(2,6,17,0.5)',
                padding: '0.625rem 0.875rem',
                color: 'white',
                fontSize: '0.875rem',
                boxSizing: 'border-box',
              }}
            >
              {NATIVE_LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value} style={{ background: '#0f172a' }}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              学习语言
            </label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              style={{
                width: '100%',
                borderRadius: '0.5rem',
                border: '1px solid rgba(100,116,139,0.3)',
                background: 'rgba(2,6,17,0.5)',
                padding: '0.625rem 0.875rem',
                color: 'white',
                fontSize: '0.875rem',
                boxSizing: 'border-box',
              }}
            >
              <option value="ja" style={{ background: '#0f172a' }}>{LANGUAGE_LABELS.ja}</option>
              <option value="en" style={{ background: '#0f172a' }}>{LANGUAGE_LABELS.en}</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              学习等级
            </label>
            <select
              value={targetLevel}
              onChange={(e) => setTargetLevel(e.target.value)}
              style={{
                width: '100%',
                borderRadius: '0.5rem',
                border: '1px solid rgba(100,116,139,0.3)',
                background: 'rgba(2,6,17,0.5)',
                padding: '0.625rem 0.875rem',
                color: 'white',
                fontSize: '0.875rem',
                boxSizing: 'border-box',
              }}
            >
              <option value="beginner" style={{ background: '#0f172a' }}>{LEVEL_LABELS.beginner}</option>
              <option value="intermediate" style={{ background: '#0f172a' }}>{LEVEL_LABELS.intermediate}</option>
              <option value="advanced" style={{ background: '#0f172a' }}>{LEVEL_LABELS.advanced}</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              默认填空等级
            </label>
            <select
              value={fillBlankLevel}
              onChange={(e) => setFillBlankLevel(Number(e.target.value))}
              style={{
                width: '100%',
                borderRadius: '0.5rem',
                border: '1px solid rgba(100,116,139,0.3)',
                background: 'rgba(2,6,17,0.5)',
                padding: '0.625rem 0.875rem',
                color: 'white',
                fontSize: '0.875rem',
                boxSizing: 'border-box',
              }}
            >
              <option value={1} style={{ background: '#0f172a' }}>L1 (容易 - 挖空少)</option>
              <option value={2} style={{ background: '#0f172a' }}>L2 (中等)</option>
              <option value={3} style={{ background: '#0f172a' }}>L3 (较难)</option>
              <option value={4} style={{ background: '#0f172a' }}>L4 (极难 - 全文挖空)</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                flex: 1,
                padding: '0.625rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(100,116,139,0.2)',
                background: 'transparent',
                color: '#64748b',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                padding: '0.625rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'linear-gradient(135deg,#3b82f6,#7c3aed)',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
