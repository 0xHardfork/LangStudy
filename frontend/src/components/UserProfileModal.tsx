import { useState, useEffect } from 'react'
import { upsertLearningProfile } from '../services/api'
import type { UserLearningProfile } from '../types'
import { LANGUAGE_LABELS, LEVEL_LABELS } from '../types'
import { useAppStore } from '../store/useAppStore'

interface Props {
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

export default function UserProfileModal({ initialProfile, onSave, onClose }: Props) {
  const token = useAppStore(state => state.token!)
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
      const targets = initialProfile.target_languages
      if (targets && targets.length > 0 && targets[0]) {
        setTargetLang(targets[0].lang)
        setTargetLevel(targets[0].level)
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
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900/95 border border-slate-850 rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl"
      >
        <h2 className="text-slate-100 font-bold text-xl mb-4">
          个人设定
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-305 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              昵称
            </label>
            <input
              type="text"
              required
              maxLength={64}
              placeholder="请输入您的昵称"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-slate-100 text-sm outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              母语
            </label>
            <select
              value={nativeLang}
              onChange={(e) => setNativeLang(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-slate-100 text-sm outline-none focus:border-blue-500/50 transition-colors"
            >
              {NATIVE_LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value} className="bg-slate-950">
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              学习语言
            </label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-slate-100 text-sm outline-none focus:border-blue-500/50 transition-colors"
            >
              <option value="ja" className="bg-slate-950">{LANGUAGE_LABELS.ja}</option>
              <option value="en" className="bg-slate-950">{LANGUAGE_LABELS.en}</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              学习等级
            </label>
            <select
              value={targetLevel}
              onChange={(e) => setTargetLevel(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-slate-100 text-sm outline-none focus:border-blue-500/50 transition-colors"
            >
              <option value="beginner" className="bg-slate-950">{LEVEL_LABELS.beginner}</option>
              <option value="intermediate" className="bg-slate-950">{LEVEL_LABELS.intermediate}</option>
              <option value="advanced" className="bg-slate-950">{LEVEL_LABELS.advanced}</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              默认填空等级
            </label>
            <select
              value={fillBlankLevel}
              onChange={(e) => setFillBlankLevel(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-slate-100 text-sm outline-none focus:border-blue-500/50 transition-colors"
            >
              <option value={1} className="bg-slate-950">L1 (容易 - 挖空少)</option>
              <option value={2} className="bg-slate-950">L2 (中等)</option>
              <option value={3} className="bg-slate-950">L3 (较难)</option>
              <option value={4} className="bg-slate-950">L4 (极难 - 全文挖空)</option>
            </select>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg border border-slate-800 bg-transparent text-slate-500 text-sm font-semibold cursor-pointer hover:bg-slate-800/40 hover:text-slate-350 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg border-0 bg-gradient-to-r from-blue-500 to-violet-500 text-white text-sm font-semibold cursor-pointer shadow-lg shadow-blue-500/20 hover:opacity-95 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
