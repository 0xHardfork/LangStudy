import { useEffect } from 'react'
import type { DialogueLine } from '../../types'
import { AudioControls } from '../common/AudioPlayer'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.includes(' ') ? text.split(' ') : text.split('')
}

function splitToken(token: string): { prefix: string; clean: string; suffix: string } {
  const isPunctuation = (char: string | undefined) => {
    if (!char) return false
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

// ─── FillBlankCard Props ─────────────────────────────────────────────────────

interface FillBlankCardProps {
  line: DialogueLine
  currentIndex: number
  fillBlankLevel: number
  inputs: Record<number, string>
  submitted: boolean
  isCorrect: boolean
  submitting: boolean
  wrongCount: number
  showTranslation: boolean
  setShowTranslation: (s: boolean) => void
  onInput: (idx: number, val: string) => void
  onSubmit: () => void
  onNext: () => void
  onPrev: () => void
  hasPrev: boolean
  hasNext: boolean
}

export default function FillBlankCard({
  line,
  currentIndex,
  fillBlankLevel,
  inputs,
  submitted,
  isCorrect,
  submitting,
  wrongCount,
  showTranslation,
  setShowTranslation,
  onInput,
  onSubmit,
  onNext,
  onPrev,
  hasPrev,
  hasNext,
}: FillBlankCardProps) {
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

  // Focus first input box on mount or sentence index change
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

  // Focus next button when submitted
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

  return (
    <div className="w-full max-w-3xl">
      {/* Speaker bubble */}
      <div
        className={`rounded-3xl p-8 md:p-10 border relative shadow-2xl ${
          line.speaker === 'A'
            ? 'border-blue-500/25 bg-blue-950/20'
            : 'border-violet-500/25 bg-violet-950/20'
        }`}
      >
        {/* Speaker label + audio controls */}
        <div className="flex items-center justify-between mb-6">
          <span
            className={`text-sm font-bold tracking-wider ${
              line.speaker === 'A' ? 'text-blue-455' : 'text-violet-455'
            }`}
          >
            {line.speaker === 'A' ? '👩 Speaker A' : '👨 Speaker B'}
          </span>
          <AudioControls audioPath={line.audio_path} lineIdx={currentIndex} />
        </div>

        {showTranslation ? (
          <div className="mb-7">
            <p className="text-lg text-slate-400 m-0 mb-2 italic leading-relaxed">
              {line.translation}
            </p>
            <button
              onClick={() => setShowTranslation(false)}
              className="bg-transparent border-0 text-slate-500 text-sm cursor-pointer p-0 underline hover:text-slate-450 transition-colors"
            >
              隐藏译文
            </button>
          </div>
        ) : (
          <div className="mb-7">
            <button
              onClick={() => setShowTranslation(true)}
              className="bg-slate-800/30 border border-slate-700/50 text-slate-400 text-sm cursor-pointer px-3 py-1.5 rounded-lg font-semibold hover:bg-slate-700/40 hover:text-slate-200 transition-colors"
            >
              👁️ 显示中文释义
            </button>
          </div>
        )}

        {/* Fill-blank area */}
        <div className="flex flex-wrap gap-x-3 gap-y-2.5 items-center leading-relaxed">
          {tokens.map((tok, idx) => {
            const { prefix, clean, suffix } = splitToken(tok)
            if (blankIndices.has(idx)) {
              const given = inputs[idx] ?? ''
              const correct = given.trim().toLowerCase() === clean.toLowerCase()
              return (
                <span key={idx} className="inline-flex items-center gap-0.5">
                  {prefix && <span className="text-slate-200 text-2xl">{prefix}</span>}
                  <input
                    id={`blank-${currentIndex}-${idx}`}
                    value={given}
                    onChange={(e) => onInput(idx, e.target.value)}
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
                    }}
                    className={`py-1.5 px-2.5 rounded-lg text-2xl text-center outline-none transition-all duration-150 ${
                      submitted
                        ? correct
                          ? 'border-2 border-green-500 bg-green-500/10 text-slate-100'
                          : 'border-2 border-red-500 bg-red-500/10 text-slate-100'
                        : 'border-2 border-dashed border-violet-500/60 bg-violet-500/15 text-slate-100'
                    }`}
                    placeholder="___"
                  />
                  {suffix && <span className="text-slate-200 text-2xl">{suffix}</span>}
                </span>
              )
            }
            return (
              <span key={idx} className="text-slate-200 text-2xl">
                {tok}
              </span>
            )
          })}
        </div>

        {/* Answer feedback */}
        {submitted && (
          <div
            className={`mt-6 p-4 rounded-xl border font-semibold text-lg ${
              isCorrect
                ? 'bg-green-500/10 border-green-500/30 text-green-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            {isCorrect ? '✅ 正确！' : `❌ 正确答案：${line.original_text}`}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-7 flex gap-3">
        {hasPrev && (
          <button
            id="btn-prev-line"
            onClick={onPrev}
            className="px-8 py-4 rounded-xl font-bold text-lg border border-slate-700 bg-slate-800/40 text-slate-400 cursor-pointer hover:bg-slate-700/50 hover:text-slate-200 transition-all duration-150"
          >
            ← 上一句
          </button>
        )}
        {!submitted ? (
          <button
            id="btn-submit-answer"
            onClick={onSubmit}
            disabled={submitting}
            className="flex-1 px-8 py-4 rounded-xl font-bold text-lg border-0 bg-gradient-to-r from-blue-500 to-violet-500 text-white cursor-pointer shadow-lg shadow-violet-500/20 transition-opacity hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中...' : '提交答案'}
          </button>
        ) : (
          <button
            id="btn-next-line"
            onClick={onNext}
            className="flex-1 px-8 py-4 rounded-xl font-bold text-lg border border-violet-500/40 bg-violet-500/15 text-violet-300 cursor-pointer hover:bg-violet-500/25 transition-all duration-150"
          >
            {hasNext ? '下一句 →' : '查看结果 🎉'}
          </button>
        )}
      </div>

      {/* Wrong count badge */}
      {wrongCount > 0 && (
        <p className="text-center mt-3 text-red-400 text-xs">
          错误 {wrongCount} 句（已加入复习队列）
        </p>
      )}
    </div>
  )
}
