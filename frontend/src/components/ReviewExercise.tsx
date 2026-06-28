import { useState, useEffect, useRef, useCallback } from 'react'
import type { ReviewItem, GrammarQuizReviewDetail } from '../types'
import { getDueReviews, getReviewSchedule, submitAnswer, getDueGrammarReviews, submitGrammarAnswer } from '../services/api'

// ─── AudioControls ──────────────────────────────────────────────────────────

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
    a.onerror = () => setPlayState('idle')
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

  // Cleanup on unmount
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

function ListPlayButton({ audioPath }: { audioPath: string }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const play = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    const a = new Audio('/' + audioPath)
    a.onended = () => setPlaying(false)
    a.onerror = () => setPlaying(false)
    audioRef.current = a
    setPlaying(true)
    a.play().catch((err) => {
      console.error(err)
      setPlaying(false)
    })
  }

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setPlaying(false)
  }

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        if (playing) {
          stop()
        } else {
          play()
        }
      }}
      title={playing ? "停止" : "播放语音"}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '1.25rem',
        padding: '0.25rem 0.5rem',
        borderRadius: '0.375rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: playing ? '#c084fc' : '#94a3b8',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.15)'
        e.currentTarget.style.color = '#c084fc'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.color = playing ? '#c084fc' : '#94a3b8'
      }}
    >
      {playing ? '⏸' : '🔊'}
    </button>
  )
}

interface Props {
  token: string
  fillBlankLevel: number
  onFinish: () => void
}

function tokenize(text: string): string[] {
  return text.includes(' ') ? text.split(' ') : text.split('')
}

function splitToken(token: string): { prefix: string; clean: string; suffix: string } {
  const isPunctuation = (char: string) => {
    return /^[^\p{L}\p{N}]+$/u.test(char)
  }

  let start = 0
  while (start < token.length && isPunctuation(token[start])) {
    start++
  }

  let end = token.length
  while (end > start && isPunctuation(token[end - 1])) {
    end--
  }

  return {
    prefix: token.slice(0, start),
    clean: token.slice(start, end),
    suffix: token.slice(end),
  }
}

function getBlankIndices(vocabulary: any[], level: number): Set<number> {
  if (level === 4) return new Set()
  const sorted = [...vocabulary].sort((a, b) => a.importance - b.importance)
  const sliced = sorted.slice(0, level)
  return new Set(sliced.map((v) => v.word_index))
}

export default function ReviewExercise({ token, fillBlankLevel, onFinish }: Props) {
  const [reviewType, setReviewType] = useState<'dialogue' | 'grammar'>('dialogue')
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [allReviews, setAllReviews] = useState<ReviewItem[]>([])
  const [grammarReviews, setGrammarReviews] = useState<GrammarQuizReviewDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialogue reviews states
  const [showChart, setShowChart] = useState(true)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [inputs, setInputs] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [doneCount, setDoneCount] = useState(0)

  // Grammar reviews states
  const [showGrammarStart, setShowGrammarStart] = useState(true)
  const [grammarIdx, setGrammarIdx] = useState(0)
  const [grammarSelectedOption, setGrammarSelectedOption] = useState<number | null>(null)
  const [grammarIsCorrect, setGrammarIsCorrect] = useState<boolean | null>(null)
  const [grammarSubmitted, setGrammarSubmitted] = useState(false)
  const [grammarDoneCount, setGrammarDoneCount] = useState(0)

  // Fetch reviews and all scheduled items
  useEffect(() => {
    Promise.all([
      getDueReviews(token),
      getReviewSchedule(token),
      getDueGrammarReviews(token)
    ])
      .then(([dueData, allData, grammarData]) => {
        setReviews(dueData)
        setAllReviews(allData)
        setGrammarReviews(grammarData)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  // Focus first blank input when starting/switching reviews
  useEffect(() => {
    if (reviewType === 'dialogue' && !showChart && reviews.length > 0 && currentIdx < reviews.length) {
      const item = reviews[currentIdx]
      const tokens = tokenize(item.original_text)
      const blankIndices = fillBlankLevel === 4
        ? new Set(
            tokens
              .map((tok, idx) => {
                const { clean } = splitToken(tok)
                return clean.length > 0 ? idx : -1
              })
              .filter((idx) => idx !== -1)
          )
        : getBlankIndices(item.vocabulary || [], fillBlankLevel)

      if (blankIndices.size > 0) {
        const sorted = Array.from(blankIndices).sort((a, b) => a - b)
        const firstIdx = sorted[0]
        const timer = setTimeout(() => {
          const el = document.getElementById(`review-blank-${currentIdx}-${firstIdx}`)
          if (el) {
            el.focus()
          }
        }, 50)
        return () => clearTimeout(timer)
      }
    }
  }, [currentIdx, reviews.length, showChart, fillBlankLevel, reviewType])

  // Focus next button after submit
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

  // ─── Grammar Reviews Active Panel ──────────────────────────────────────────

  if (reviewType === 'grammar' && !showGrammarStart) {
    if (grammarReviews.length === 0) return (
      <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
        <div style={{ fontSize: '3rem' }}>🎉</div>
        <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.5rem' }}>暂无需要复习的语法题</h2>
        <button onClick={onFinish} style={{ padding: '0.75rem 2rem', borderRadius: '0.75rem', border: 'none', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
          返回主页
        </button>
      </div>
    )

    if (grammarIdx >= grammarReviews.length) return (
      <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
        <div style={{ fontSize: '3rem' }}>🎉</div>
        <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.5rem' }}>语法复习完成！</h2>
        <p style={{ color: '#64748b' }}>共复习 {grammarDoneCount} 道题</p>
        <button onClick={onFinish} style={{ padding: '0.75rem 2rem', borderRadius: '0.75rem', border: 'none', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
          返回主页
        </button>
      </div>
    )

    const item = grammarReviews[grammarIdx]

    const handleSelectOption = async (optionIdx: number) => {
      if (grammarSubmitted) return
      setGrammarSelectedOption(optionIdx)
      const correct = optionIdx === item.correct_option
      setGrammarIsCorrect(correct)
      setGrammarSubmitted(true)
      setGrammarDoneCount((c) => c + 1)
      try {
        await submitGrammarAnswer(token, { grammar_quiz_id: item.grammar_quiz_id, is_correct: correct })
      } catch (err) {
        console.warn('Failed to submit grammar answer:', err)
      }
    }

    const handleNextGrammar = () => {
      setGrammarIdx((i) => i + 1)
      setGrammarSelectedOption(null)
      setGrammarIsCorrect(null)
      setGrammarSubmitted(false)
    }

    return (
      <div style={{ minHeight: '100vh', background: '#020617', color: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(100,116,139,0.15)', background: 'rgba(15,23,42,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>🧠 语法错题复习</span>
            <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>{grammarIdx + 1} / {grammarReviews.length}</div>
          </div>
          <button onClick={() => setShowGrammarStart(true)} style={{ padding: '0.375rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(100,116,139,0.3)', background: 'transparent', color: '#64748b', fontSize: '0.8125rem', cursor: 'pointer' }}>
            查看计划
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Original Sentence Audio & Context Card */}
            <div style={{ borderRadius: '1rem', padding: '1.25rem', border: '1px solid rgba(100,116,139,0.15)', background: 'rgba(30,41,59,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#a78bfa', fontWeight: 600 }}>原句发音与释义</span>
                {item.audio_path && <AudioControls audioPath={item.audio_path} lineIdx={grammarIdx + 2000} />}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#cbd5e1', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                💬 {item.sentence_trans}
              </div>
              {grammarSubmitted && (
                <div style={{ fontSize: '0.8125rem', color: '#94a3b8', background: 'rgba(15,23,42,0.4)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(100,116,139,0.06)' }}>
                  <strong>语法深度讲解：</strong>{item.sentence_explain}
                </div>
              )}
            </div>

            {/* Quiz Card */}
            <div style={{ borderRadius: '1rem', padding: '1.5rem', border: '1px solid rgba(124,58,237,0.25)', background: 'rgba(46,16,101,0.2)' }}>
              <div style={{ fontSize: '1.125rem', color: '#f1f5f9', fontWeight: 700, lineHeight: 1.5, marginBottom: '1.25rem' }}>
                {item.question}
              </div>

              {/* Options list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {item.options.map((opt, idx) => {
                  const isSelected = grammarSelectedOption === idx
                  const isCorrectOpt = item.correct_option === idx
                  let bg = 'rgba(15,23,42,0.4)'
                  let border = '1px solid rgba(100,116,139,0.2)'
                  let textColor = '#cbd5e1'

                  if (grammarSubmitted) {
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
                      disabled={grammarSubmitted}
                      onClick={() => handleSelectOption(idx)}
                      style={{
                        width: '100%',
                        padding: '0.875rem 1rem',
                        borderRadius: '0.75rem',
                        background: bg,
                        border: border,
                        color: textColor,
                        textAlign: 'left',
                        fontSize: '0.9375rem',
                        cursor: grammarSubmitted ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                        outline: 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!grammarSubmitted) {
                          e.currentTarget.style.background = 'rgba(124,58,237,0.1)'
                          e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!grammarSubmitted) {
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

              {/* Explanations section */}
              {grammarSubmitted && (
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    background: grammarIsCorrect ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${grammarIsCorrect ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: grammarIsCorrect ? '#86efac' : '#fca5a5' }}>
                    {grammarIsCorrect ? '✅ 答对了！' : `❌ 答错了，正确答案是 ${String.fromCharCode(65 + item.correct_option)}`}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
                    <span style={{ fontWeight: 600, color: '#94a3b8' }}>选项解析：</span>
                    {item.options.map((opt, idx) => {
                      const explain = (item.explanations as any)[idx]
                      const isCorrectOpt = item.correct_option === idx
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

            {grammarSubmitted && (
              <button
                id="btn-next-grammar-review"
                onClick={handleNextGrammar}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(124,58,237,0.4)',
                  background: 'rgba(124,58,237,0.15)',
                  color: '#c4b5fd',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {grammarIdx + 1 >= grammarReviews.length ? '完成复习 🎉' : '下一题 →'}
              </button>
            )}

          </div>
        </div>
      </div>
    )
  }

  // ─── Dialogue Reviews Start/Dashboard Screen ───────────────────────────────

  if (reviewType === 'dialogue' && showChart) {
    const dates: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      dates.push(d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }))
    }

    const grouped: Record<string, ReviewItem[]> = {}
    dates.forEach((d) => {
      grouped[d] = []
    })

    const todayStr = dates[0]
    allReviews.forEach((item) => {
      const itemDate = new Date(item.next_review_at)
      const endOfToday = new Date()
      endOfToday.setHours(23, 59, 59, 999)

      if (itemDate <= endOfToday) {
        grouped[todayStr].push(item)
      } else {
        const itemDateStr = itemDate.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
        if (grouped[itemDateStr]) {
          grouped[itemDateStr].push(item)
        }
      }
    })

    const maxCount = Math.max(...dates.map((d) => grouped[d].length), 5)
    const activeIdx = hoveredIdx !== null ? hoveredIdx : 0
    const activeDateStr = dates[activeIdx]
    const activeItems = grouped[activeDateStr] || []

    return (
      <div style={{ minHeight: '100vh', background: '#020617', color: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif', padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              📊 艾宾浩斯复习计划
            </h2>
            <button onClick={onFinish} style={{ padding: '0.4rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(100,116,139,0.3)', background: 'transparent', color: '#94a3b8', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }}>
              返回主页
            </button>
          </div>

          {/* Tab Selector */}
          <div style={{ display: 'flex', background: 'rgba(15,23,42,0.6)', padding: '4px', borderRadius: '0.75rem', border: '1px solid rgba(100,116,139,0.1)' }}>
            <button
              onClick={() => setReviewType('dialogue')}
              style={{
                flex: 1,
                padding: '0.625rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'rgba(124,58,237,0.2)',
                color: '#c4b5fd',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              🔄 听力填空 ({reviews.length})
            </button>
            <button
              onClick={() => setReviewType('grammar')}
              style={{
                flex: 1,
                padding: '0.625rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'transparent',
                color: '#94a3b8',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              🧠 语法单选 ({grammarReviews.length})
            </button>
          </div>

          {/* Line Chart Card */}
          <div style={{ padding: '1.5rem', borderRadius: '1rem', background: 'rgba(30,41,59,0.2)', border: '1px solid rgba(100,116,139,0.15)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>未来 7 天听力复习规划统计</span>
              <span style={{ fontSize: '0.75rem', color: '#475569' }}>💡 鼠标悬停查看每日句子概要</span>
            </div>
            
            <div style={{ width: '100%', height: '200px', display: 'flex', justifyContent: 'center' }}>
              <svg width="100%" height="200" viewBox="0 0 560 200" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>

                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const yVal = 30 + ratio * 130
                  const labelVal = Math.round(maxCount * (1 - ratio))
                  return (
                    <g key={idx}>
                      <line x1="40" y1={yVal} x2="520" y2={yVal} stroke="rgba(100,116,139,0.1)" strokeDasharray="4 4" />
                      <text x="30" y={yVal + 4} textAnchor="end" fill="#475569" fontSize="10">{labelVal}</text>
                    </g>
                  )
                })}

                {dates.map((d, i) => {
                  const xVal = 40 + (i / 6) * 480
                  const isToday = i === 0
                  return (
                    <text key={i} x={xVal} y="185" textAnchor="middle" fill={isToday ? '#60a5fa' : '#64748b'} fontSize="10" fontWeight={isToday ? 700 : 400}>
                      {isToday ? '今日' : d}
                    </text>
                  )
                })}

                <path
                  d={dates.map((d, i) => {
                    const xVal = 40 + (i / 6) * 480
                    const yVal = 30 + 130 - (grouped[d].length / maxCount) * 130
                    return `${i === 0 ? 'M' : 'L'} ${xVal} ${yVal}`
                  }).join(' ')}
                  fill="none"
                  stroke="url(#chartGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {dates.map((d, i) => {
                  const xVal = 40 + (i / 6) * 480
                  const count = grouped[d].length
                  const yVal = 30 + 130 - (count / maxCount) * 130
                  const isActive = activeIdx === i

                  return (
                    <g key={i}>
                      <circle
                        cx={xVal}
                        cy={yVal}
                        r="18"
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredIdx(i)}
                      />
                      <circle
                        cx={xVal}
                        cy={yVal}
                        r={isActive ? "7" : "5"}
                        fill={isActive ? "#c084fc" : "#3b82f6"}
                        stroke="#020617"
                        strokeWidth="2"
                        style={{ transition: 'all 0.15s ease', pointerEvents: 'none' }}
                      />
                      <text
                        x={xVal}
                        y={yVal - 10}
                        textAnchor="middle"
                        fill={isActive ? "#c084fc" : "#94a3b8"}
                        fontSize="10"
                        fontWeight="bold"
                        style={{ pointerEvents: 'none', transition: 'all 0.15s ease' }}
                      >
                        {count}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>

          {/* Planned Sentences Summary List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', color: '#94a3b8', fontWeight: 600 }}>
              {activeIdx === 0 ? '今日待复习句子的概要' : `${activeDateStr} 计划复习句子的概要`}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {activeItems.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', background: 'rgba(15,23,42,0.3)', borderRadius: '0.75rem', border: '1px solid rgba(100,116,139,0.08)', display: 'flex', justifyContent: 'center', color: '#475569', fontSize: '0.875rem' }}>
                  此日期没有计划复习的句子
                </div>
              ) : (
                activeItems.map((item, idx) => (
                  <div key={item.id || idx} style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(100,116,139,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.875rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                        {item.translation}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#475569' }}>
                        复习轮次: 第 {item.review_count + 1} 轮
                      </span>
                    </div>
                    {item.audio_path && (
                      <ListPlayButton audioPath={item.audio_path} />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Button at bottom */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
            {reviews.length > 0 ? (
              <button
                onClick={() => setShowChart(false)}
                style={{
                  width: '100%',
                  padding: '1rem 2rem',
                  borderRadius: '0.875rem',
                  border: 'none',
                  background: 'linear-gradient(135deg,#3b82f6,#7c3aed)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                🚀 开始今日听力复习 ({reviews.length} 句)
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                <div style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', textAlign: 'center', color: '#86efac', fontSize: '0.875rem' }}>
                  🎉 太棒了！今天所有的听写复习都已完成！
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── Grammar Reviews Start/Dashboard Screen ───────────────────────────────

  if (reviewType === 'grammar' && showGrammarStart) {
    return (
      <div style={{ minHeight: '100vh', background: '#020617', color: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif', padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              📊 艾宾浩斯复习计划
            </h2>
            <button onClick={onFinish} style={{ padding: '0.4rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(100,116,139,0.3)', background: 'transparent', color: '#94a3b8', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }}>
              返回主页
            </button>
          </div>

          {/* Tab Selector */}
          <div style={{ display: 'flex', background: 'rgba(15,23,42,0.6)', padding: '4px', borderRadius: '0.75rem', border: '1px solid rgba(100,116,139,0.1)' }}>
            <button
              onClick={() => setReviewType('dialogue')}
              style={{
                flex: 1,
                padding: '0.625rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'transparent',
                color: '#94a3b8',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              🔄 听力填空 ({reviews.length})
            </button>
            <button
              onClick={() => setReviewType('grammar')}
              style={{
                flex: 1,
                padding: '0.625rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'rgba(124,58,237,0.2)',
                color: '#c4b5fd',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              🧠 语法单选 ({grammarReviews.length})
            </button>
          </div>

          {/* Grammar Details Card */}
          <div
            style={{
              padding: '2rem 1.5rem',
              borderRadius: '1rem',
              background: 'rgba(30,41,59,0.2)',
              border: '1px solid rgba(100,116,139,0.15)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '3rem' }}>🧠</div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#f1f5f9', fontWeight: 700 }}>
              语法错题复习计划
            </h3>
            <p style={{ margin: 0, fontSize: '0.9375rem', color: '#94a3b8', lineHeight: 1.5 }}>
              今日共有 <strong>{grammarReviews.length}</strong> 道语法错题需要复习。<br />
              做错的语法选择题会通过艾宾浩斯记忆法，在未来不同的时间点再次推送给你，直到你完全掌握。
            </p>
            
            {grammarReviews.length > 0 ? (
              <button
                onClick={() => setShowGrammarStart(false)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  background: 'linear-gradient(135deg,#3b82f6,#7c3aed)',
                  color: 'white',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                  marginTop: '1rem',
                }}
              >
                🚀 开始语法错题复习 ({grammarReviews.length} 题)
              </button>
            ) : (
              <div style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#86efac', fontSize: '0.875rem', marginTop: '1rem' }}>
                🎉 太棒了！今天没有需要复习的语法错题！
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── Dialogue Reviews Active Exercises ─────────────────────────────────────

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
      <div style={{ fontSize: '3rem' }}>🎉</div>
      <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.5rem' }}>复习完成！</h2>
      <p style={{ color: '#64748b' }}>共复习 {doneCount} 句</p>
      <button onClick={onFinish} style={{ padding: '0.75rem 2rem', borderRadius: '0.75rem', border: 'none', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
        返回主页
      </button>
    </div>
  )

  const item = reviews[currentIdx]

  const handleSubmit = async () => {
    const normalize = (s: string) => {
      return s
        .trim()
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    }
    const tokens = tokenize(item.original_text)
    const blankIndices = fillBlankLevel === 4
      ? new Set(
          tokens
            .map((tok, idx) => {
              const { clean } = splitToken(tok)
              return clean.length > 0 ? idx : -1
            })
            .filter((idx) => idx !== -1)
        )
      : getBlankIndices(item.vocabulary || [], fillBlankLevel)

    let correct = true
    for (const idx of blankIndices) {
      const given = normalize(inputs[idx] ?? '')
      const tok = tokens[idx] ?? ''
      const { clean } = splitToken(tok)
      const expected = normalize(clean)
      if (given !== expected) {
        correct = false
        break
      }
    }

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
    setInputs({})
    setSubmitted(false)
    setIsCorrect(false)
  }

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((i) => i - 1)
      setInputs({})
      setSubmitted(false)
      setIsCorrect(false)
    }
  }

  const tokens = tokenize(item.original_text)
  const blankIndices = fillBlankLevel === 4
    ? new Set(
        tokens
          .map((tok, idx) => {
            const { clean } = splitToken(tok)
            return clean.length > 0 ? idx : -1
          })
          .filter((idx) => idx !== -1)
      )
    : getBlankIndices(item.vocabulary || [], fillBlankLevel)

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(100,116,139,0.15)', background: 'rgba(15,23,42,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>🔄 听写复习</span>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>{currentIdx + 1} / {reviews.length}</div>
        </div>
        <button onClick={() => setShowChart(true)} style={{ padding: '0.375rem 0.875rem', borderRadius: '0.5rem', border: '1px solid rgba(100,116,139,0.3)', background: 'transparent', color: '#64748b', fontSize: '0.8125rem', cursor: 'pointer' }}>
          查看计划
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: '600px' }}>
          <div style={{ borderRadius: '1rem', padding: '1.75rem', border: '1px solid rgba(124,58,237,0.25)', background: 'rgba(46,16,101,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a78bfa' }}>复习 #{item.review_count + 1}</span>
              <AudioControls audioPath={item.audio_path} lineIdx={currentIdx} />
            </div>

            <p style={{ color: '#CBD5E1', fontSize: '1.125rem', marginBottom: '1.5rem', fontWeight: 500, lineHeight: 1.5 }}>
              💬 {item.translation}
            </p>

            {item.audio_path && (
              <p style={{ color: '#475569', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
                💡 提示：可以先点 🔊 听读音再填写
              </p>
            )}

            {/* Fill-blank area */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem 0.625rem',
              alignItems: 'center',
              lineHeight: 1.8,
              marginTop: '1.5rem',
              marginBottom: '1.5rem',
            }}>
              {tokens.map((tok, idx) => {
                const { prefix, clean, suffix } = splitToken(tok)
                if (blankIndices.has(idx)) {
                  const given = inputs[idx] ?? ''
                  const correct = given.trim().toLowerCase() === clean.toLowerCase()
                  return (
                    <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.125rem' }}>
                      {prefix && <span style={{ color: '#e2e8f0', fontSize: '1.25rem' }}>{prefix}</span>}
                      <input
                        id={`review-blank-${currentIdx}-${idx}`}
                        value={given}
                        onChange={(e) => setInputs(prev => ({ ...prev, [idx]: e.target.value }))}
                        disabled={submitted}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const sorted = Array.from(blankIndices).sort((a, b) => a - b)
                            const unfilled = sorted.filter(i => {
                              if (i === idx) {
                                return !e.currentTarget.value.trim()
                              }
                              return !(inputs[i] ?? '').trim()
                            })
                            if (unfilled.length > 0) {
                              const nextEl = document.getElementById(`review-blank-${currentIdx}-${unfilled[0]}`)
                              if (nextEl) {
                                nextEl.focus()
                              }
                            } else {
                              const btn = document.getElementById('btn-submit-review')
                              if (btn) {
                                btn.focus()
                              }
                            }
                          }
                        }}
                        style={{
                          width: `${Math.max(clean.length * 0.8, 3.5)}rem`,
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.375rem',
                          border: submitted
                            ? (correct ? '2px solid #22c55e' : '2px solid #ef4444')
                            : '2px dashed rgba(124,58,237,0.6)',
                          background: submitted
                            ? (correct ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)')
                            : 'rgba(124,58,237,0.15)',
                          color: '#f1f5f9',
                          fontSize: '1.25rem',
                          textAlign: 'center',
                          outline: 'none',
                          transition: 'all 0.15s ease',
                        }}
                        placeholder="___"
                      />
                      {suffix && <span style={{ color: '#e2e8f0', fontSize: '1.25rem' }}>{suffix}</span>}
                    </span>
                  )
                }
                return (
                  <span key={idx} style={{ color: '#e2e8f0', fontSize: '1.25rem' }}>
                    {tok}
                  </span>
                )
              })}
            </div>

            {submitted && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '0.625rem', background: isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: isCorrect ? '#86efac' : '#fca5a5', fontSize: '0.9375rem', fontWeight: 600 }}>
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
