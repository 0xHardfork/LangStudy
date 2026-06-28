import { useState, useRef, useCallback, useEffect } from 'react'
import type { Dialogue, UserLearningProfile } from '../types'
import { regenerateDialogue } from '../services/api'
import { useAppStore } from '../store/useAppStore'

// ─── Audio ──────────────────────────────────────────────────────────────────

function PreviewAudio({ audioPath, idx }: { audioPath: string | null; idx: number }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    setPlaying(false)
  }, [])

  const toggle = useCallback(() => {
    if (!audioPath) return
    if (playing) { stop(); return }
    stop()
    const a = new Audio('/' + audioPath)
    a.onended = stop
    audioRef.current = a
    setPlaying(true)
    a.play()
  }, [audioPath, playing, stop])

  useEffect(() => () => stop(), [stop])

  const disabled = !audioPath
  return (
    <button
      id={`preview-audio-${idx}`}
      onClick={toggle}
      disabled={disabled}
      title={playing ? '停止' : '播放'}
      className={`px-2.5 py-1 rounded-md text-sm border transition-all duration-150 ${
        playing
          ? 'border-blue-500 bg-blue-500/20 text-blue-300'
          : disabled
          ? 'border-slate-800 bg-slate-900/30 text-slate-700 cursor-not-allowed'
          : 'border-slate-700/50 bg-slate-800/50 text-slate-400 cursor-pointer hover:bg-slate-700/50 hover:text-slate-200'
      }`}
    >
      {playing ? '⏸' : '🔊'}
    </button>
  )
}

// ─── Line Card ───────────────────────────────────────────────────────────────

function PreviewLine({ line, idx }: { line: Dialogue['lines'][0]; idx: number }) {
  const [showTrans, setShowTrans] = useState(false)
  const isA = line.speaker === 'A'
  return (
    <div
      className={`p-4 rounded-xl flex flex-col gap-2 border ${
        isA
          ? 'bg-blue-950/40 border-blue-500/15'
          : 'bg-violet-950/40 border-violet-500/15'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold flex items-center gap-1.5 ${
          isA ? 'text-blue-400' : 'text-violet-400'
        }`}>
          {isA ? '👩' : '👨'} Speaker {line.speaker}
          <span className="text-slate-600 font-normal">#{idx + 1}</span>
        </span>
        <PreviewAudio audioPath={line.audio_path} idx={idx} />
      </div>
      <p className="m-0 text-slate-100 text-[15px] leading-relaxed">
        {line.original_text}
      </p>
      {showTrans ? (
        <div className="mt-1">
          <p className="m-0 mb-1 text-[13px] text-slate-400 italic">
            {line.translation}
          </p>
          <button
            onClick={() => setShowTrans(false)}
            className="bg-transparent border-0 text-slate-600 text-xs cursor-pointer p-0 hover:text-slate-450 transition-colors"
          >
            隐藏译文
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowTrans(true)}
          className="self-start bg-slate-800/10 border border-slate-700/60 text-slate-400 text-xs cursor-pointer py-1 px-2.5 rounded hover:bg-slate-750 hover:text-slate-200 transition-colors"
        >
          👁️ 查看译文
        </button>
      )}
    </div>
  )
}

// ─── Regenerate Modal ────────────────────────────────────────────────────────

interface RegenerateModalProps {
  onConfirm: (hint: string) => void
  onClose: () => void
  loading: boolean
  error: string | null
}

function RegenerateModal({ onConfirm, onClose, loading, error }: RegenerateModalProps) {
  const [hint, setHint] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [])

  const handleSubmit = () => {
    if (loading) return
    onConfirm(hint)
  }

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900/97 border border-violet-500/30 rounded-2xl p-6 md:p-8 w-full max-w-lg shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">✏️</span>
          <div>
            <h3 className="m-0 font-bold text-base text-slate-100">
              对这段对话有什么建议？
            </h3>
            <p className="m-0 text-xs text-slate-500 mt-1">
              AI 将根据你的建议、话题背景和学习配置重新生成一段全新的对话
            </p>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
          }}
          placeholder="例如：请让对话更口语化，多用缩写；或者：场景太正式了，换成朋友之间的聊天..."
          rows={4}
          className="w-full p-3.5 rounded-lg border border-slate-800 bg-slate-950/50 text-slate-100 text-sm leading-relaxed resize-y outline-none focus:border-violet-500/50 transition-colors font-inherit"
        />

        {error && (
          <p className="text-red-400 text-xs mt-2">
            ⚠️ {error}
          </p>
        )}

        <p className="text-slate-650 text-[11px] my-3">
          提示为空时将直接用原设置重新生成 · Ctrl+Enter 快速提交
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="py-2.5 px-5 rounded-lg border border-slate-800 bg-transparent text-slate-400 text-sm cursor-pointer hover:bg-slate-800/50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`py-2.5 px-6 rounded-lg border-0 text-white text-sm font-semibold cursor-pointer flex items-center gap-2 transition-all duration-150 ${
              loading
                ? 'bg-slate-800 text-slate-650 cursor-not-allowed'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-95 shadow-md shadow-violet-600/20'
            }`}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                生成中...
              </>
            ) : '🔄 确认重新生成'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DialoguePreview ─────────────────────────────────────────────────────────

interface Props {
  dialogue: Dialogue
  initialLineIndex: number
  learningProfile: UserLearningProfile | null
  onStart: () => void
  onRegenerate: (newDialogue: Dialogue) => void
  onSelectNewTopic: () => void
  onBack: () => void
}

export default function DialoguePreview({
  dialogue, initialLineIndex, learningProfile,
  onStart, onRegenerate, onSelectNewTopic, onBack,
}: Props) {
  const token = useAppStore(state => state.token!)
  const [showModal, setShowModal] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState<string | null>(null)
  const isResuming = initialLineIndex > 0

  const handleRegenerateConfirm = async (hint: string) => {
    setRegenerating(true)
    setRegenError(null)
    try {
      const newDialogue = await regenerateDialogue(token, {
        prev_dialogue_id: dialogue.id,
        topic: dialogue.topic,
        language: dialogue.language,
        level: dialogue.level,
        hint,
        native_language: learningProfile?.native_language ?? 'zh',
      })
      setShowModal(false)
      onRegenerate(newDialogue)
    } catch (e: unknown) {
      setRegenError((e as Error).message ?? '重新生成失败')
    } finally {
      setRegenerating(false)
    }
  }

  const LANG_LABEL: Record<string, string> = {
    ja: '日语', en: '英语', ko: '韩语', fr: '法语', de: '德语', es: '西班牙语',
  }
  const LEVEL_LABEL: Record<string, string> = {
    beginner: '初级', intermediate: '中级', advanced: '高级',
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-900 px-6 h-16 flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 bg-transparent border border-slate-800 rounded-lg py-1.5 px-3 text-slate-400 text-sm font-semibold cursor-pointer hover:bg-slate-800 hover:text-slate-200 transition-colors"
        >
          ← 返回
        </button>

        <div className="flex-1 text-center">
          <div className="font-bold text-base text-slate-100">
            对话预览
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {dialogue.topic} · {LANG_LABEL[dialogue.language] ?? dialogue.language} · {LEVEL_LABEL[dialogue.level] ?? dialogue.level}
          </div>
        </div>

        <button
          id="btn-select-new-topic"
          onClick={onSelectNewTopic}
          className="bg-transparent border border-slate-800 rounded-lg py-1.5 px-3 text-slate-400 text-xs font-semibold cursor-pointer hover:bg-slate-800 hover:text-slate-200 transition-colors whitespace-nowrap"
        >
          换主题
        </button>
      </header>

      {/* Resume banner */}
      {isResuming && (
        <div className="bg-blue-500/5 border border-indigo-500/20 rounded-xl mx-6 mt-4 p-3 flex items-center gap-3">
          <span className="text-xl">🔖</span>
          <div>
            <div className="font-semibold text-sm text-indigo-300">
              继续上次的学习
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              你上次进行到第 {initialLineIndex + 1} 句，点击下方按钮继续
            </div>
          </div>
        </div>
      )}

      {/* Dialogue lines */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-6 flex flex-col gap-3 pb-28">
        <div className="flex items-center justify-between mb-2">
          <p className="m-0 text-slate-500 text-xs">
            {dialogue.lines.length} 句对话，请预览后开始学习
          </p>
          <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${
            dialogue.is_rejected
              ? 'bg-red-500/10 border-red-500/20 text-red-300'
              : 'bg-green-500/10 border-green-500/20 text-green-300'
          }`}>
            {dialogue.is_rejected ? '已标记不满意' : '当前推荐'}
          </span>
        </div>

        {dialogue.lines.map((line, idx) => (
          <div
            key={line.id}
            style={{
              opacity: isResuming && idx < initialLineIndex ? 0.45 : 1,
            }}
          >
            <PreviewLine line={line} idx={idx} />
          </div>
        ))}
      </main>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-900 px-6 py-4 flex gap-3 justify-center z-40">
        <button
          id="btn-preview-regenerate"
          onClick={() => { setRegenError(null); setShowModal(true) }}
          className="py-3 px-6 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-450 text-sm font-semibold cursor-pointer flex items-center gap-1.5 transition-all hover:bg-slate-800 hover:text-slate-250"
        >
          ✏️ 重新生成
        </button>

        <button
          id="btn-preview-start"
          onClick={onStart}
          className="flex-1 max-w-[320px] py-3 px-8 rounded-xl border-0 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-base font-bold cursor-pointer transition-all duration-150 flex items-center justify-center gap-1.5 shadow-lg shadow-violet-600/30 hover:opacity-95 hover:scale-[1.01] hover:shadow-violet-600/40"
        >
          {isResuming ? `🔖 从第 ${initialLineIndex + 1} 句继续` : '🚀 开始学习'}
        </button>
      </div>

      {/* Regenerate modal */}
      {showModal && (
        <RegenerateModal
          onConfirm={handleRegenerateConfirm}
          onClose={() => !regenerating && setShowModal(false)}
          loading={regenerating}
          error={regenError}
        />
      )}
    </div>
  )
}
