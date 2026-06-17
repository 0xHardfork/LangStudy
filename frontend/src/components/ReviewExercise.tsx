import { useState, useEffect, useRef, useCallback } from 'react'
import type { ReviewItem } from '../types'
import { getDueReviews, submitAnswer } from '../services/api'

type PlayState = 'idle' | 'playing' | 'looping'

function AudioControls({ audioPath, lineIdx }: { audioPath: string | null; lineIdx: number }) {
  const [playState, setPlayState] = useState<PlayState>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setPlayState('idle')
  }, [])

  const handlePlay = useCallback(() => {
    if (!audioPath) return
    stop()
    const a = new Audio('/' + audioPath)
    a.loop = false
    a.onended = () => setPlayState('idle')
    audioRef.current = a
    setPlayState('playing')
    a.play()
  }, [audioPath, stop])

  const handleLoop = useCallback(() => {
    if (!audioPath) return
    if (playState === 'looping') { stop(); return }
    stop()
    const a = new Audio('/' + audioPath)
    a.loop = true
    audioRef.current = a
    setPlayState('looping')
    a.play()
  }, [audioPath, playState, stop])

  useEffect(() => () => { stop() }, [stop])

  const disabled = !audioPath
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      <button onClick={handlePlay} disabled={disabled || playState === 'playing'}
        id={`btn-play-review-${lineIdx}`} title="播放一次"
        style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.875rem', border: '1px solid rgba(100,116,139,0.3)', background: 'rgba(30,41,59,0.6)', color: disabled ? '#475569' : '#94a3b8', cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {playState === 'playing' ? '⏸' : '🔊'}
      </button>
      <button onClick={handleLoop} disabled={disabled}
        id={`btn-loop-review-${lineIdx}`} title="循环播放"
        style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.875rem', border: playState === 'looping' ? '1px solid #7c3aed' : '1px solid rgba(100,116,139,0.3)', background: playState === 'looping' ? 'rgba(124,58,237,0.25)' : 'rgba(30,41,59,0.6)', color: playState === 'looping' ? '#c4b5fd' : (disabled ? '#475569' : '#94a3b8'), cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {playState === 'looping' ? '⏹' : '🔁'}
      </button>
    </div>
  )
}

interface Props {
  token: string
  onFinish: () => void
}

export default function ReviewExercise({ token, onFinish }: Props) {
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [input, setInput] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [doneCount, setDoneCount] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (reviews.length > 0 && currentIdx < reviews.length) {
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [currentIdx, reviews.length])

  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(() => {
        const btn = document.getElementById('btn-next-review')
        if (btn) {
          btn.focus()
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [submitted])

  useEffect(() => {
    getDueReviews(token)
      .then(setReviews)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#94a3b8', fontSize: '1rem' }}>加载复习内容...</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#f87171' }}>加载失败：{error}</div>
    </div>
  )

  if (reviews.length === 0) return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
      <div style={{ fontSize: '3rem' }}>🎉</div>
      <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.5rem' }}>暂无需要复习的内容</h2>
      <p style={{ color: '#64748b' }}>继续保持，明天再来！</p>
      <button onClick={onFinish} style={{ padding: '0.75rem 2rem', borderRadius: '0.75rem', border: 'none', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
        返回主页
      </button>
    </div>
  )

  if (currentIdx >= reviews.length) return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
      <div style={{ fontSize: '3rem' }}>✅</div>
      <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.5rem' }}>复习完成！</h2>
      <p style={{ color: '#64748b' }}>共复习 {doneCount} 句</p>
      <button onClick={onFinish} style={{ padding: '0.75rem 2rem', borderRadius: '0.75rem', border: 'none', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
        返回主页
      </button>
    </div>
  )

  const item = reviews[currentIdx]
  const normalize = (s: string) => {
    return s
      .trim()
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const handleSubmit = async () => {
    const correct = normalize(input) === normalize(item.original_text)
    setIsCorrect(correct)
    setSubmitted(true)
    setDoneCount((c) => c + 1)
    try {
      await submitAnswer(token, { dialogue_line_id: item.dialogue_line_id, is_correct: correct })
    } catch (e) {
      console.warn('submitAnswer failed', e)
    }
  }

  const handleNext = () => {
    setCurrentIdx((i) => i + 1)
    setInput('')
    setSubmitted(false)
    setIsCorrect(false)
  }

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((i) => i - 1)
      setInput('')
      setSubmitted(false)
      setIsCorrect(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(100,116,139,0.15)', background: 'rgba(15,23,42,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>🔄 艾宾浩斯复习</span>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>{currentIdx + 1} / {reviews.length}</div>
        </div>
        <button onClick={onFinish} style={{ padding: '0.375rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(100,116,139,0.3)', background: 'transparent', color: '#64748b', fontSize: '0.8125rem', cursor: 'pointer' }}>
          返回
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: '600px' }}>
          <div style={{ borderRadius: '1rem', padding: '1.75rem', border: '1px solid rgba(124,58,237,0.25)', background: 'rgba(46,16,101,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a78bfa' }}>复习 #{item.review_count + 1}</span>
              <AudioControls audioPath={item.audio_path} lineIdx={currentIdx} />
            </div>

            <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '1.5rem', fontStyle: 'italic' }}>
              💬 {item.translation}
            </p>

            {item.audio_path && (
              <p style={{ color: '#475569', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
                💡 提示：可以先点 🔊 听读音再填写
              </p>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={submitted}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  const btn = document.getElementById('btn-submit-review')
                  if (btn) {
                    btn.focus()
                  }
                  handleSubmit()
                }
              }}
              placeholder="请输入完整句子..."
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '0.75rem',
                borderRadius: '0.625rem',
                border: submitted ? (isCorrect ? '1px solid #22c55e' : '1px solid #ef4444') : '1px solid rgba(100,116,139,0.3)',
                background: 'rgba(15,23,42,0.6)', color: '#f1f5f9',
                fontSize: '1rem', resize: 'vertical', outline: 'none',
              }}
            />

            {submitted && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '0.625rem', background: isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: isCorrect ? '#86efac' : '#fca5a5', fontSize: '0.875rem', fontWeight: 600 }}>
                {isCorrect ? '✅ 正确！' : `❌ 正确答案：${item.original_text}`}
              </div>
            )}
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
            {currentIdx > 0 && (
              <button
                id="btn-prev-review"
                onClick={handlePrev}
                style={{
                  padding: '0.875rem 1.5rem',
                  borderRadius: '0.75rem', border: '1px solid rgba(100,116,139,0.3)',
                  background: 'rgba(30,41,59,0.5)', color: '#94a3b8',
                  fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                ← 上一句
              </button>
            )}
            {!submitted ? (
              <button
                id="btn-submit-review"
                onClick={handleSubmit}
                style={{ flex: 1, padding: '0.875rem', borderRadius: '0.75rem', border: 'none', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', color: 'white', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
              >
                提交
              </button>
            ) : (
              <button
                id="btn-next-review"
                onClick={handleNext}
                style={{ flex: 1, padding: '0.875rem', borderRadius: '0.75rem', border: '1px solid rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.15)', color: '#c4b5fd', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
              >
                {currentIdx + 1 >= reviews.length ? '完成复习 🎉' : '下一条 →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
