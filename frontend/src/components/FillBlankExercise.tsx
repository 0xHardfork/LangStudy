import { useState, useRef, useEffect, useCallback } from 'react'
import type { Dialogue, DialogueLine } from '../types'
import { submitAnswer, updateDialogueProgress } from '../services/api'

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
      <button
        id={`btn-play-audio-${lineIdx}`}
        onClick={handlePlay}
        disabled={disabled || playState === 'playing'}
        title="播放一次"
        style={{
          padding: '4px 8px', borderRadius: '6px', fontSize: '0.875rem',
          border: '1px solid rgba(100,116,139,0.3)',
          background: playState === 'playing' ? 'rgba(59,130,246,0.2)' : 'rgba(30,41,59,0.6)',
          color: disabled ? '#475569' : '#94a3b8',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        {playState === 'playing' ? '⏸' : '🔊'}
      </button>
      <button
        id={`btn-loop-audio-${lineIdx}`}
        onClick={handleLoop}
        disabled={disabled}
        title="循环播放"
        style={{
          padding: '4px 8px', borderRadius: '6px', fontSize: '0.875rem',
          border: playState === 'looping'
            ? '1px solid #7c3aed'
            : '1px solid rgba(100,116,139,0.3)',
          background: playState === 'looping' ? 'rgba(124,58,237,0.25)' : 'rgba(30,41,59,0.6)',
          color: playState === 'looping' ? '#c4b5fd' : (disabled ? '#475569' : '#94a3b8'),
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
          outline: playState === 'looping' ? '2px solid rgba(124,58,237,0.4)' : 'none',
        }}
      >
        {playState === 'looping' ? '⏹' : '🔁'}
      </button>
    </div>
  )
}

function DialogueLineItem({ ln, idx }: { ln: DialogueLine; idx: number }) {
  const [showTrans, setShowTrans] = useState(false)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '1rem',
        borderRadius: '0.75rem',
        background: ln.speaker === 'A' ? 'rgba(23,37,84,0.3)' : 'rgba(46,16,101,0.3)',
        border: ln.speaker === 'A' ? '1px solid rgba(59,130,246,0.15)' : '1px solid rgba(124,58,237,0.15)',
        marginBottom: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: ln.speaker === 'A' ? '#60a5fa' : '#a78bfa',
        }}>
          {ln.speaker === 'A' ? '👩 Speaker A' : '👨 Speaker B'}
        </span>
        <AudioControls audioPath={ln.audio_path} lineIdx={idx + 1000} />
      </div>
      <p style={{ margin: 0, fontSize: '0.9375rem', color: '#f1f5f9', lineHeight: 1.5 }}>
        {ln.original_text}
      </p>
      {showTrans ? (
        <div>
          <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic' }}>
            {ln.translation}
          </p>
          <button
            onClick={() => setShowTrans(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '0.75rem',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            隐藏译文
          </button>
        </div>
      ) : (
        <div>
          <button
            onClick={() => setShowTrans(true)}
            style={{
              background: 'rgba(100,116,139,0.1)',
              border: '1px solid rgba(100,116,139,0.2)',
              color: '#94a3b8',
              fontSize: '0.75rem',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              fontWeight: 600,
            }}
          >
            👁️ 显示释义
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Fill Blank Logic ───────────────────────────────────────────────────────

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

function getBlankIndices(line: DialogueLine, level: number): Set<number> {
  if (level === 4) return new Set()
  const sorted = [...line.vocabulary].sort((a, b) => a.importance - b.importance)
  const sliced = sorted.slice(0, level)
  return new Set(sliced.map((v) => v.word_index))
}

// ─── FillBlankExercise ──────────────────────────────────────────────────────

interface Props {
  token: string
  dialogue: Dialogue
  fillBlankLevel: number
  initialLineIndex?: number
  onFinish: (wrongCount: number) => void
  onLevelChange: (level: number) => void
  onBack: () => void
}

export default function FillBlankExercise({
  token, dialogue, fillBlankLevel, initialLineIndex = 0, onFinish, onLevelChange, onBack,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialLineIndex)
  const [inputs, setInputs] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [wrongCount, setWrongCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [showFullTextModal, setShowFullTextModal] = useState(false)

  const line = dialogue.lines[currentIndex]
  const tokens = tokenize(line.original_text)
  const blankIndices = fillBlankLevel === 4
    ? new Set(
        tokens
          .map((tok, idx) => {
            const { clean } = splitToken(tok)
            return clean.length > 0 ? idx : -1
          })
          .filter((idx) => idx !== -1)
      )
    : getBlankIndices(line, fillBlankLevel)

  useEffect(() => {
    if (blankIndices.size > 0) {
      const sorted = Array.from(blankIndices).sort((a, b) => a - b)
      const firstIdx = sorted[0]
      const timer = setTimeout(() => {
        const el = document.getElementById(`blank-${currentIndex}-${firstIdx}`)
        if (el) {
          el.focus()
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [currentIndex, fillBlankLevel, blankIndices.size])

  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(() => {
        const btn = document.getElementById('btn-next-line')
        if (btn) {
          btn.focus()
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [submitted])

  const handleInput = (idx: number, val: string) => {
    setInputs((prev) => ({ ...prev, [idx]: val }))
  }

  const checkAnswer = (): boolean => {
    const normalize = (s: string) => {
      return s
        .trim()
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    }
    for (const idx of blankIndices) {
      const given = normalize(inputs[idx] ?? '')
      const tok = tokens[idx] ?? ''
      const { clean } = splitToken(tok)
      const expected = normalize(clean)
      if (given !== expected) return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (submitting) return
    const correct = checkAnswer()
    setIsCorrect(correct)
    setSubmitted(true)
    if (!correct) setWrongCount((w) => w + 1)

    setSubmitting(true)
    try {
      await submitAnswer(token, {
        dialogue_line_id: line.id,
        is_correct: correct,
      })
    } catch (e) {
      console.warn('submitAnswer failed', e)
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = () => {
    const nextIdx = currentIndex + 1
    if (nextIdx >= dialogue.lines.length) {
      // Mark as completed
      updateDialogueProgress(token, dialogue.id, nextIdx, true).catch(console.warn)
      onFinish(wrongCount)
      return
    }
    // Save progress (fire-and-forget)
    updateDialogueProgress(token, dialogue.id, nextIdx, false).catch(console.warn)
    setCurrentIndex(nextIdx)
    setInputs({})
    setSubmitted(false)
    setIsCorrect(false)
    setShowTranslation(false)
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1
      updateDialogueProgress(token, dialogue.id, prevIdx, false).catch(console.warn)
      setCurrentIndex(prevIdx)
      setInputs({})
      setSubmitted(false)
      setIsCorrect(false)
      setShowTranslation(false)
    }
  }

  const progress = ((currentIndex + 1) / dialogue.lines.length) * 100

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.5rem', borderBottom: '1px solid rgba(100,116,139,0.15)',
        background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            {dialogue.topic} · {dialogue.language.toUpperCase()}
          </span>
          <div style={{ marginTop: '0.5rem', height: '4px', width: '200px', background: 'rgba(100,116,139,0.2)', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#3b82f6,#7c3aed)', transition: 'width 0.3s ease', borderRadius: '9999px' }} />
          </div>
          <span style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
            {currentIndex + 1} / {dialogue.lines.length}
          </span>
        </div>

        {/* Level selector */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            id="btn-go-home"
            onClick={onBack}
            style={{
              padding: '0.375rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 600,
              border: '1px solid rgba(148,163,184,0.3)',
              background: 'rgba(30,41,59,0.5)',
              color: '#94a3b8',
              cursor: 'pointer', transition: 'all 0.15s ease',
              marginRight: '0.5rem',
            }}
          >
            🏠 回到首页
          </button>
          <button
            id="btn-show-full-text"
            onClick={() => setShowFullTextModal(true)}
            style={{
              padding: '0.375rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 600,
              border: '1px solid rgba(59,130,246,0.3)',
              background: 'rgba(59,130,246,0.15)',
              color: '#60a5fa',
              cursor: 'pointer', transition: 'all 0.15s ease',
              marginRight: '0.5rem',
            }}
          >
            📄 显示全文
          </button>
          {[1, 2, 3, 4].map((lvl) => (
            <button
              key={lvl}
              id={`level-btn-${lvl}`}
              onClick={() => onLevelChange(lvl)}
              style={{
                padding: '0.375rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 600,
                border: fillBlankLevel === lvl ? '1px solid #7c3aed' : '1px solid rgba(100,116,139,0.3)',
                background: fillBlankLevel === lvl ? 'rgba(124,58,237,0.25)' : 'rgba(30,41,59,0.5)',
                color: fillBlankLevel === lvl ? '#c4b5fd' : '#94a3b8',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              L{lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: '840px' }}>
          {/* Speaker bubble */}
          <div style={{
            borderRadius: '1.5rem', padding: '2rem 2.5rem 2.5rem 2.5rem',
            border: line.speaker === 'A'
              ? '1px solid rgba(59,130,246,0.25)'
              : '1px solid rgba(124,58,237,0.25)',
            background: line.speaker === 'A'
              ? 'rgba(23,37,84,0.4)'
              : 'rgba(46,16,101,0.4)',
            position: 'relative',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          }}>
            {/* Speaker label + audio controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <span style={{
                fontSize: '0.875rem', fontWeight: 700, letterSpacing: '0.05em',
                color: line.speaker === 'A' ? '#60a5fa' : '#a78bfa',
              }}>
                {line.speaker === 'A' ? '👩 Speaker A' : '👨 Speaker B'}
              </span>
              <AudioControls audioPath={line.audio_path} lineIdx={currentIndex} />
            </div>

            {showTranslation ? (
              <div style={{ marginBottom: '1.75rem' }}>
                <p style={{ fontSize: '1.125rem', color: '#94a3b8', margin: '0 0 0.5rem 0', fontStyle: 'italic', lineHeight: 1.6 }}>
                  {line.translation}
                </p>
                <button
                  onClick={() => setShowTranslation(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  隐藏释义
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: '1.75rem' }}>
                <button
                  onClick={() => setShowTranslation(true)}
                  style={{
                    background: 'rgba(100,116,139,0.1)',
                    border: '1px solid rgba(100,116,139,0.2)',
                    color: '#94a3b8',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '0.5rem',
                    fontWeight: 600,
                  }}
                >
                  👁️ 显示中文释义
                </button>
              </div>
            )}

            {/* Fill-blank area */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.625rem 0.75rem',
              alignItems: 'center',
              lineHeight: 1.8,
            }}>
              {tokens.map((tok, idx) => {
                const { prefix, clean, suffix } = splitToken(tok)
                if (blankIndices.has(idx)) {
                  const given = inputs[idx] ?? ''
                  const correct = given.trim().toLowerCase() === clean.toLowerCase()
                  return (
                    <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.125rem' }}>
                      {prefix && <span style={{ color: '#e2e8f0', fontSize: '1.5rem' }}>{prefix}</span>}
                      <input
                        id={`blank-${currentIndex}-${idx}`}
                        value={given}
                        onChange={(e) => handleInput(idx, e.target.value)}
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
                              const nextEl = document.getElementById(`blank-${currentIndex}-${unfilled[0]}`)
                              if (nextEl) {
                                nextEl.focus()
                              }
                            } else {
                              const btn = document.getElementById('btn-submit-answer')
                              if (btn) {
                                btn.focus()
                              }
                            }
                          }
                        }}
                        style={{
                          width: `${Math.max(clean.length * 0.9, 4.5)}rem`,
                          padding: '0.375rem 0.625rem',
                          borderRadius: '0.5rem',
                          border: submitted
                            ? (correct ? '2px solid #22c55e' : '2px solid #ef4444')
                            : '2px dashed rgba(124,58,237,0.6)',
                          background: submitted
                            ? (correct ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)')
                            : 'rgba(124,58,237,0.15)',
                          color: '#f1f5f9',
                          fontSize: '1.5rem',
                          textAlign: 'center',
                          outline: 'none',
                          transition: 'all 0.15s ease',
                        }}
                        placeholder="___"
                      />
                      {suffix && <span style={{ color: '#e2e8f0', fontSize: '1.5rem' }}>{suffix}</span>}
                    </span>
                  )
                }
                return (
                  <span key={idx} style={{ color: '#e2e8f0', fontSize: '1.5rem' }}>
                    {tok}
                  </span>
                )
              })}
            </div>

            {/* Answer feedback */}
            {submitted && (
              <div style={{
                marginTop: '1.5rem', padding: '1rem',
                borderRadius: '0.75rem',
                background: isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: isCorrect ? '#86efac' : '#fca5a5',
                fontSize: '1.125rem', fontWeight: 600,
              }}>
                {isCorrect ? '✅ 正确！' : `❌ 正确答案：${line.original_text}`}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ marginTop: '1.75rem', display: 'flex', gap: '0.75rem' }}>
            {currentIndex > 0 && (
              <button
                id="btn-prev-line"
                onClick={handlePrev}
                style={{
                  padding: '1rem 2rem',
                  borderRadius: '0.75rem', fontWeight: 700, fontSize: '1.125rem',
                  border: '1px solid rgba(100,116,139,0.3)',
                  background: 'rgba(30,41,59,0.5)',
                  color: '#94a3b8', cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                ← 上一句
              </button>
            )}
            {!submitted ? (
              <button
                id="btn-submit-answer"
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  flex: 1, padding: '1rem 2rem',
                  borderRadius: '0.75rem', fontWeight: 700, fontSize: '1.125rem',
                  border: 'none',
                  background: 'linear-gradient(135deg,#3b82f6,#7c3aed)',
                  color: 'white', cursor: 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  transition: 'opacity 0.15s ease',
                  boxShadow: '0 4px 20px rgba(124,58,237,0.3)',
                }}
              >
                {submitting ? '提交中...' : '提交答案'}
              </button>
            ) : (
              <button
                id="btn-next-line"
                onClick={handleNext}
                style={{
                  flex: 1, padding: '1rem 2rem',
                  borderRadius: '0.75rem', fontWeight: 700, fontSize: '1.125rem',
                  border: '1px solid rgba(124,58,237,0.4)',
                  background: 'rgba(124,58,237,0.15)',
                  color: '#c4b5fd', cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {currentIndex + 1 >= dialogue.lines.length ? '查看结果 🎉' : '下一句 →'}
              </button>
            )}
          </div>

          {/* Wrong count badge */}
          {wrongCount > 0 && (
            <p style={{ textAlign: 'center', marginTop: '0.75rem', color: '#f87171', fontSize: '0.8125rem' }}>
              错误 {wrongCount} 句（已加入复习队列）
            </p>
          )}
        </div>
      </div>

      {showFullTextModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(2,6,17,0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '1.5rem',
        }}>
          <div style={{
            background: 'rgba(15,23,42,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            borderRadius: '1.25rem',
            padding: '1.5rem 2rem 2rem 2rem',
            maxWidth: '720px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              borderBottom: '1px solid rgba(100,116,139,0.15)',
              paddingBottom: '0.75rem',
            }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f1f5f9' }}>
                {dialogue.topic} - 对话全文
              </h3>
              <button
                id="btn-close-full-text"
                onClick={() => setShowFullTextModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = '#f1f5f9')}
                onMouseOut={(e) => (e.currentTarget.style.color = '#94a3b8')}
              >
                ✕
              </button>
            </div>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              paddingRight: '0.5rem',
            }}>
              {dialogue.lines.map((ln, idx) => (
                <DialogueLineItem key={ln.id} ln={ln} idx={idx} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
