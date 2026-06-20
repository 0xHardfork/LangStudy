import { useState, useRef, useCallback, useEffect } from 'react'
import type { Dialogue, UserLearningProfile } from '../types'
import { regenerateDialogue } from '../services/api'

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
      style={{
        padding: '4px 10px',
        borderRadius: '6px',
        border: playing ? '1px solid #3b82f6' : '1px solid rgba(100,116,139,0.3)',
        background: playing ? 'rgba(59,130,246,0.2)' : 'rgba(30,41,59,0.5)',
        color: disabled ? '#475569' : (playing ? '#93c5fd' : '#94a3b8'),
        fontSize: '0.875rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
      }}
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
      style={{
        padding: '1rem 1.25rem',
        borderRadius: '0.875rem',
        background: isA ? 'rgba(23,37,84,0.4)' : 'rgba(46,16,101,0.4)',
        border: isA ? '1px solid rgba(59,130,246,0.15)' : '1px solid rgba(124,58,237,0.15)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: isA ? '#60a5fa' : '#a78bfa',
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
        }}>
          {isA ? '👩' : '👨'} Speaker {line.speaker}
          <span style={{ color: '#475569', fontWeight: 400 }}>#{idx + 1}</span>
        </span>
        <PreviewAudio audioPath={line.audio_path} idx={idx} />
      </div>
      <p style={{ margin: 0, fontSize: '1rem', color: '#f1f5f9', lineHeight: 1.55 }}>
        {line.original_text}
      </p>
      {showTrans ? (
        <div>
          <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic' }}>
            {line.translation}
          </p>
          <button
            onClick={() => setShowTrans(false)}
            style={{ background: 'none', border: 'none', color: '#475569', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
          >
            隐藏译文
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowTrans(true)}
          style={{
            alignSelf: 'flex-start',
            background: 'rgba(100,116,139,0.1)',
            border: '1px solid rgba(100,116,139,0.2)',
            color: '#94a3b8',
            fontSize: '0.75rem',
            cursor: 'pointer',
            padding: '0.2rem 0.5rem',
            borderRadius: '0.25rem',
          }}
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
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(15,23,42,0.97)',
          border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: '1.25rem',
          padding: '2rem',
          width: '100%', maxWidth: '500px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '1.5rem' }}>✏️</span>
          <div>
            <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.125rem', color: '#f1f5f9' }}>
              对这段对话有什么建议？
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
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
          style={{
            width: '100%',
            padding: '0.875rem',
            borderRadius: '0.625rem',
            border: '1px solid rgba(100,116,139,0.3)',
            background: 'rgba(30,41,59,0.5)',
            color: '#f1f5f9',
            fontSize: '0.9375rem',
            lineHeight: 1.55,
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />

        {error && (
          <p style={{ color: '#fca5a5', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
            ⚠️ {error}
          </p>
        )}

        <p style={{ color: '#475569', fontSize: '0.75rem', margin: '0.5rem 0 1rem' }}>
          提示为空时将直接用原设置重新生成 · Ctrl+Enter 快速提交
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: '0.625rem',
              border: '1px solid rgba(100,116,139,0.2)',
              background: 'transparent',
              color: '#94a3b8',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: '0.625rem 1.5rem',
              borderRadius: '0.625rem',
              border: 'none',
              background: loading ? 'rgba(100,116,139,0.2)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              color: loading ? '#64748b' : 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
            }}
          >
            {loading ? (
              <>
                <span style={{ width: '1rem', height: '1rem', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
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
  token: string
  dialogue: Dialogue
  initialLineIndex: number
  learningProfile: UserLearningProfile | null
  onStart: () => void
  onRegenerate: (newDialogue: Dialogue) => void
  onSelectNewTopic: () => void
  onBack: () => void
}

export default function DialoguePreview({
  token, dialogue, initialLineIndex, learningProfile,
  onStart, onRegenerate, onSelectNewTopic, onBack,
}: Props) {
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
    <div style={{
      minHeight: '100vh',
      background: '#020617',
      color: '#f1f5f9',
      fontFamily: 'Inter, system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
      `}</style>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(2,6,23,0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(100,116,139,0.12)',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            background: 'transparent',
            border: '1px solid rgba(100,116,139,0.25)',
            borderRadius: '0.5rem',
            padding: '0.4rem 0.875rem',
            color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ← 返回
        </button>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f1f5f9' }}>
            对话预览
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.125rem' }}>
            {dialogue.topic} · {LANG_LABEL[dialogue.language] ?? dialogue.language} · {LEVEL_LABEL[dialogue.level] ?? dialogue.level}
          </div>
        </div>

        <button
          id="btn-select-new-topic"
          onClick={onSelectNewTopic}
          style={{
            background: 'transparent',
            border: '1px solid rgba(100,116,139,0.25)',
            borderRadius: '0.5rem',
            padding: '0.4rem 0.875rem',
            color: '#94a3b8', fontSize: '0.8125rem', fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          换主题
        </button>
      </header>

      {/* Resume banner */}
      {isResuming && (
        <div style={{
          background: 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(124,58,237,0.12))',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: '0.75rem',
          margin: '1rem 1.5rem 0',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          animation: 'fadeIn 0.4s ease',
        }}>
          <span style={{ fontSize: '1.25rem' }}>🔖</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#a5b4fc' }}>
              继续上次的学习
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.125rem' }}>
              你上次进行到第 {initialLineIndex + 1} 句，点击下方按钮继续
            </div>
          </div>
        </div>
      )}

      {/* Dialogue lines */}
      <main style={{
        flex: 1,
        maxWidth: '680px',
        margin: '0 auto',
        width: '100%',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        paddingBottom: '7rem', // space for sticky bottom bar
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '0.5rem',
        }}>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
            {dialogue.lines.length} 句对话，请预览后开始学习
          </p>
          <span style={{
            padding: '0.25rem 0.625rem',
            borderRadius: '9999px',
            background: dialogue.is_rejected ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
            border: dialogue.is_rejected ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(34,197,94,0.2)',
            color: dialogue.is_rejected ? '#fca5a5' : '#86efac',
            fontSize: '0.7rem',
            fontWeight: 600,
          }}>
            {dialogue.is_rejected ? '已标记不满意' : '当前推荐'}
          </span>
        </div>

        {dialogue.lines.map((line, idx) => (
          <div
            key={line.id}
            style={{
              opacity: isResuming && idx < initialLineIndex ? 0.45 : 1,
              animation: `fadeIn 0.3s ease ${idx * 0.02}s both`,
            }}
          >
            <PreviewLine line={line} idx={idx} />
          </div>
        ))}
      </main>

      {/* Sticky bottom bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(2,6,23,0.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(100,116,139,0.12)',
        padding: '1rem 1.5rem',
        display: 'flex',
        gap: '0.75rem',
        justifyContent: 'center',
        zIndex: 50,
      }}>
        <button
          id="btn-preview-regenerate"
          onClick={() => { setRegenError(null); setShowModal(true) }}
          style={{
            padding: '0.875rem 1.5rem',
            borderRadius: '0.875rem',
            border: '1px solid rgba(100,116,139,0.25)',
            background: 'rgba(30,41,59,0.6)',
            color: '#94a3b8',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(30,41,59,0.9)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(30,41,59,0.6)'}
        >
          ✏️ 重新生成
        </button>

        <button
          id="btn-preview-start"
          onClick={onStart}
          style={{
            flex: 1,
            maxWidth: '320px',
            padding: '0.875rem 2rem',
            borderRadius: '0.875rem',
            border: 'none',
            background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)',
            color: 'white',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(124,58,237,0.5)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,58,237,0.35)' }}
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
