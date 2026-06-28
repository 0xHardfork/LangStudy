import React, { useState, useEffect, useRef } from 'react'
import type { GrammarArticle, GrammarQuiz } from '../types'
import { analyzeText, getGrammarHistory, getAnalyzedArticle, submitGrammarAnswer, regenerateGrammarSentence } from '../services/api'

// ─── Local Audio Player ──────────────────────────────────────────────────────

type PlayState = 'idle' | 'playing' | 'looping'

function SentenceAudio({ audioPath }: { audioPath: string | null }) {
  const [playState, setPlayState] = useState<PlayState>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setPlayState('idle')
  }

  const play = () => {
    if (!audioPath) return
    stop()
    const a = new Audio('/' + audioPath)
    a.onended = () => setPlayState('idle')
    a.onerror = () => setPlayState('idle')
    audioRef.current = a
    setPlayState('playing')
    a.play().catch(stop)
  }

  const loop = () => {
    if (!audioPath) return
    if (playState === 'looping') {
      stop()
      return
    }
    stop()
    const a = new Audio('/' + audioPath)
    a.loop = true
    audioRef.current = a
    setPlayState('looping')
    a.play().catch(stop)
  }

  useEffect(() => {
    return () => stop()
  }, [audioPath])

  if (!audioPath) return null

  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      <button
        onClick={play}
        disabled={playState === 'playing'}
        title="播放单次"
        style={{
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '0.875rem',
          border: '1px solid rgba(100,116,139,0.3)',
          background: playState === 'playing' ? 'rgba(59,130,246,0.25)' : 'rgba(30,41,59,0.6)',
          color: playState === 'playing' ? '#60a5fa' : '#94a3b8',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        {playState === 'playing' ? '⏸ 播放中' : '🔊 听音'}
      </button>
      <button
        onClick={loop}
        title="循环播放"
        style={{
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '0.875rem',
          border: playState === 'looping' ? '1px solid #7c3aed' : '1px solid rgba(100,116,139,0.3)',
          background: playState === 'looping' ? 'rgba(124,58,237,0.25)' : 'rgba(30,41,59,0.6)',
          color: playState === 'looping' ? '#c4b5fd' : '#94a3b8',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        {playState === 'looping' ? '⏹ 停止循环' : '🔁 循环'}
      </button>
    </div>
  )
}

// ─── Quiz Card Component ─────────────────────────────────────────────────────

interface QuizCardProps {
  token: string
  quiz: GrammarQuiz
}

function QuizCard({ token, quiz }: QuizCardProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Reset local state if quiz changes
  useEffect(() => {
    setSelectedIdx(null)
    setIsCorrect(null)
  }, [quiz.id])

  const handleSelect = async (idx: number) => {
    if (selectedIdx !== null || submitting) return
    setSelectedIdx(idx)
    const correct = idx === quiz.correct_option
    setIsCorrect(correct)
    setSubmitting(true)
    try {
      await submitGrammarAnswer(token, { grammar_quiz_id: quiz.id, is_correct: correct })
    } catch (err) {
      console.warn('Failed to submit grammar answer:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        padding: '1.25rem',
        borderRadius: '1rem',
        background: 'rgba(30,41,59,0.25)',
        border: '1px solid rgba(124,58,237,0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.8125rem', color: '#a78bfa', fontWeight: 600, letterSpacing: '0.05em' }}>
          🧠 完形填空专项检测 (Cloze Quiz)
        </span>
        {quiz.tags && quiz.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {quiz.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: '0.6875rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(124,58,237,0.15)',
                  border: '1px solid rgba(124,58,237,0.3)',
                  color: '#c4b5fd',
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: '1.125rem', color: '#f1f5f9', fontWeight: 600, lineHeight: 1.5 }}>
        {quiz.question}
      </div>

      {/* Options Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
        {quiz.options.map((opt, idx) => {
          const isSelected = selectedIdx === idx
          const isCorrectOpt = quiz.correct_option === idx
          let bg = 'rgba(15,23,42,0.4)'
          let border = '1px solid rgba(100,116,139,0.2)'
          let textColor = '#cbd5e1'

          if (selectedIdx !== null) {
            if (isCorrectOpt) {
              bg = 'rgba(34,197,94,0.15)'
              border = '1px solid #22c55e'
              textColor = '#86efac'
            } else if (isSelected) {
              bg = 'rgba(239,68,68,0.15)'
              border = '1px solid #ef4444'
              textColor = '#fca5a5'
            }
          }

          return (
            <button
              key={idx}
              disabled={selectedIdx !== null}
              onClick={() => handleSelect(idx)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                background: bg,
                border: border,
                color: textColor,
                textAlign: 'left',
                fontSize: '0.9375rem',
                cursor: selectedIdx !== null ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                if (selectedIdx === null) {
                  e.currentTarget.style.background = 'rgba(124,58,237,0.1)'
                  e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'
                }
              }}
              onMouseLeave={(e) => {
                if (selectedIdx === null) {
                  e.currentTarget.style.background = bg
                  e.currentTarget.style.borderColor = 'rgba(100,116,139,0.2)'
                }
              }}
            >
              <strong style={{ marginRight: '0.5rem' }}>{String.fromCharCode(65 + idx)}.</strong> {opt}
            </button>
          )
        })}
      </div>

      {/* Explanations Section */}
      {selectedIdx !== null && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '1rem',
            borderRadius: '0.75rem',
            background: isCorrect ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: isCorrect ? '#86efac' : '#fca5a5' }}>
            {isCorrect ? '✅ 答对了！' : `❌ 答错了，正确答案是 ${String.fromCharCode(65 + quiz.correct_option)}`}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
            <span style={{ fontWeight: 600, color: '#94a3b8' }}>选项解析：</span>
            {quiz.options.map((opt, idx) => {
              const explain = (quiz.explanations as any)[idx]
              const isCorrectOpt = quiz.correct_option === idx
              return (
                <div key={idx} style={{ color: '#cbd5e1', lineHeight: 1.4, paddingLeft: '0.5rem', borderLeft: `2px solid ${isCorrectOpt ? '#22c55e' : '#475569'}` }}>
                  <strong>{String.fromCharCode(65 + idx)} ({opt}):</strong> {explain || '暂无解析'}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main GrammarDashboard ───────────────────────────────────────────────────

interface Props {
  token: string
  onBack: () => void
}

export default function GrammarDashboard({ token, onBack }: Props) {
  const [history, setHistory] = useState<GrammarArticle[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [activeArticle, setActiveArticle] = useState<GrammarArticle | null>(null)
  const [activeSentIdx, setActiveSentIdx] = useState<number | null>(null)

  // Upload inputs
  const [titleInput, setTitleInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load history on mount
  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = () => {
    setLoadingHistory(true)
    getGrammarHistory(token)
      .then(setHistory)
      .catch((e) => console.error('Load grammar history error:', e))
      .finally(() => setLoadingHistory(false))
  }

  const handleStartAnalysis = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titleInput.trim() || !textInput.trim() || analyzing) return
    setAnalyzing(true)
    setError(null)
    try {
      const result = await analyzeText(token, titleInput, textInput)
      setActiveArticle(result)
      setActiveSentIdx(0) // auto-select first sentence
      setTitleInput('')
      setTextInput('')
      loadHistory() // refresh history list
    } catch (err: any) {
      setError(err.message || '分析失败，请重试')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleLoadArticle = async (id: number) => {
    setError(null)
    setActiveArticle(null)
    setActiveSentIdx(null)
    try {
      const result = await getAnalyzedArticle(token, id)
      setActiveArticle(result)
      if (result.sentences && result.sentences.length > 0) {
        setActiveSentIdx(0)
      }
    } catch (err: any) {
      alert('加载文章失败: ' + err.message)
    }
  }

  const [regenerating, setRegenerating] = useState(false)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)

  const handleRegenerate = async (sentenceId: number) => {
    if (regenerating || !activeArticle) return
    setRegenerating(true)
    setRegenerateError(null)
    try {
      const newSent = await regenerateGrammarSentence(token, sentenceId)
      const updatedSents = activeArticle.sentences?.map((s) =>
        s.id === sentenceId ? { ...s, ...newSent } : s
      )
      setActiveArticle({
        ...activeArticle,
        sentences: updatedSents,
      })
    } catch (err: any) {
      setRegenerateError(err.message || '重新生成失败，请重试')
    } finally {
      setRegenerating(false)
    }
  }

  const currentSentence =
    activeArticle?.sentences && activeSentIdx !== null
      ? activeArticle.sentences[activeSentIdx]
      : null

  const currentQuiz = currentSentence?.quizzes?.[0] || null

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header
        style={{
          borderBottom: '1px solid rgba(100,116,139,0.15)',
          background: 'rgba(15,23,42,0.8)',
          backdropFilter: 'blur(8px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          padding: '0 1.5rem',
          height: '4rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>📖</span>
          <span style={{ fontWeight: 700, fontSize: '1.125rem', background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            英语语法与文章分析
          </span>
        </div>
        <button
          onClick={onBack}
          style={{
            padding: '0.4rem 0.875rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(148,163,184,0.3)',
            background: 'rgba(30,41,59,0.5)',
            color: '#94a3b8',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          🏠 回到首页
        </button>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {!activeArticle ? (
          /* ─── Uploader & History Split View ─── */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
            
            {/* Input Form Card */}
            <div
              style={{
                padding: '1.5rem',
                borderRadius: '1.25rem',
                background: 'rgba(30,41,59,0.25)',
                border: '1px solid rgba(100,116,139,0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f1f5f9' }}>
                ✏️ 新增英文分析
              </h2>
              <form onSubmit={handleStartAnalysis} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <label style={{ fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 600 }}>文章标题</label>
                  <input
                    type="text"
                    required
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder="例如: Attributive Clause Study"
                    style={{
                      padding: '0.75rem',
                      borderRadius: '0.625rem',
                      border: '1px solid rgba(100,116,139,0.2)',
                      background: 'rgba(15,23,42,0.6)',
                      color: '#f1f5f9',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <label style={{ fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 600 }}>英文内容 (支持长文或句子)</label>
                  <textarea
                    required
                    rows={8}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="请粘贴或输入你想分析的英文段落..."
                    style={{
                      padding: '0.75rem',
                      borderRadius: '0.625rem',
                      border: '1px solid rgba(100,116,139,0.2)',
                      background: 'rgba(15,23,42,0.6)',
                      color: '#f1f5f9',
                      fontSize: '0.875rem',
                      outline: 'none',
                      resize: 'vertical',
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                {error && (
                  <div style={{ color: '#f87171', fontSize: '0.8125rem', fontWeight: 600 }}>
                    ⚠️ {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={analyzing}
                  style={{
                    padding: '0.875rem',
                    borderRadius: '0.75rem',
                    border: 'none',
                    background: analyzing ? 'rgba(59,130,246,0.3)' : 'linear-gradient(135deg,#3b82f6,#7c3aed)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.9375rem',
                    cursor: analyzing ? 'not-allowed' : 'pointer',
                    boxShadow: analyzing ? 'none' : '0 4px 12px rgba(59,130,246,0.3)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {analyzing ? 'AI 正在深度语法分析中...' : '🚀 开始语法分析'}
                </button>
              </form>
            </div>

            {/* History List Card */}
            <div
              style={{
                padding: '1.5rem',
                borderRadius: '1.25rem',
                background: 'rgba(30,41,59,0.25)',
                border: '1px solid rgba(100,116,139,0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                maxHeight: '520px',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📚 共享语法库历史</span>
                <button
                  onClick={loadHistory}
                  style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  刷新
                </button>
              </h2>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
                {loadingHistory ? (
                  <div style={{ color: '#64748b', fontSize: '0.875rem', textAlign: 'center', marginTop: '2rem' }}>加载历史记录中...</div>
                ) : history.length === 0 ? (
                  <div style={{ color: '#475569', fontSize: '0.875rem', textAlign: 'center', marginTop: '2rem' }}>暂无历史分析，赶紧上传第一篇吧！</div>
                ) : (
                  history.map((art) => (
                    <div
                      key={art.id}
                      onClick={() => handleLoadArticle(art.id)}
                      style={{
                        padding: '1rem',
                        borderRadius: '0.75rem',
                        background: 'rgba(15,23,42,0.4)',
                        border: '1px solid rgba(100,116,139,0.1)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(96,165,250,0.4)'
                        e.currentTarget.style.background = 'rgba(30,41,59,0.4)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(100,116,139,0.1)'
                        e.currentTarget.style.background = 'rgba(15,23,42,0.4)'
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#e2e8f0', marginBottom: '0.25rem' }}>
                        {art.title}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#64748b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: '0.5rem',
                        }}
                      >
                        {art.raw_text}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#475569' }}>
                        📅 上传于 {new Date(art.created_at).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ─── Article Detail View ─── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Header / Navigation back */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                onClick={() => setActiveArticle(null)}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(100,116,139,0.3)',
                  background: 'transparent',
                  color: '#94a3b8',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                ← 返回列表
              </button>
              <h2 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 800, color: '#f1f5f9' }}>
                📖 {activeArticle.title}
              </h2>
            </div>

            {/* Split view: text vs analysis panel */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem', alignItems: 'start' }}>
              
              {/* Left Side: Article clickable sentence blocks */}
              <div
                style={{
                  padding: '1.5rem',
                  borderRadius: '1.25rem',
                  background: 'rgba(30,41,59,0.15)',
                  border: '1px solid rgba(100,116,139,0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>
                  💡 提示：点击下方的英文句子即可呼出对应的深度语法解析
                </div>

                <div
                  style={{
                    fontSize: '1.125rem',
                    lineHeight: 1.8,
                    color: '#e2e8f0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  {activeArticle.sentences?.map((sent, idx) => {
                    const isActive = activeSentIdx === idx
                    return (
                      <span
                        key={sent.id || idx}
                        onClick={() => setActiveSentIdx(idx)}
                        style={{
                          cursor: 'pointer',
                          padding: '0.125rem 0.375rem',
                          borderRadius: '0.375rem',
                          background: isActive ? 'rgba(124,58,237,0.25)' : 'transparent',
                          borderBottom: isActive ? '2px solid #a78bfa' : '1px dashed rgba(100,116,139,0.2)',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'rgba(100,116,139,0.1)'
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        {sent.original_text}
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* Right Side: Grammar analysis card & Cloze quiz */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {currentSentence ? (
                  <>
                    {/* Grammar analysis card */}
                    <div
                      style={{
                        padding: '1.5rem',
                        borderRadius: '1.25rem',
                        background: 'rgba(30,41,59,0.25)',
                        border: '1px solid rgba(100,116,139,0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(100,116,139,0.1)', paddingBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>
                          句 {activeSentIdx! + 1} / {activeArticle.sentences?.length}
                        </span>
                        <SentenceAudio audioPath={currentSentence.audio_path} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>原文</span>
                        <span style={{ fontSize: '1.0625rem', color: '#f1f5f9', fontWeight: 600, lineHeight: 1.4 }}>
                          {currentSentence.original_text}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>中文释义</span>
                        <span style={{ fontSize: '0.9375rem', color: '#94a3b8', lineHeight: 1.4 }}>
                          {currentSentence.translation}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>语法讲解</span>
                          <button
                            disabled={regenerating}
                            onClick={() => handleRegenerate(currentSentence.id)}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid rgba(124,58,237,0.3)',
                              background: 'rgba(124,58,237,0.1)',
                              color: '#c4b5fd',
                              fontSize: '0.75rem',
                              cursor: regenerating ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {regenerating ? '🔄 正在重新生成...' : '🔄 重新生成 AI 解析'}
                          </button>
                        </div>
                        {regenerateError && (
                          <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.25rem' }}>
                            ⚠️ {regenerateError}
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: '0.875rem',
                            color: '#cbd5e1',
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap',
                            background: 'rgba(15,23,42,0.3)',
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            border: '1px solid rgba(100,116,139,0.06)',
                          }}
                        >
                          {currentSentence.explanation}
                        </div>
                      </div>
                    </div>

                    {/* Cloze multiple choice card */}
                    {currentQuiz && (
                      <QuizCard
                        token={token}
                        quiz={currentQuiz}
                      />
                    )}
                  </>
                ) : (
                  <div style={{ color: '#475569', fontSize: '0.9375rem', textAlign: 'center', padding: '3rem' }}>
                    请在左侧选择句子查看详情
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  )
}
