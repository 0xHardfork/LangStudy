import { useState, useEffect } from 'react'
import type { ReviewItem } from '../../types'
import { submitAnswer } from '../../services/api'
import { AudioControls, ListPlayButton } from '../common/AudioPlayer'
import { useAppStore } from '../../store/useAppStore'

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

function getBlankIndices(vocabulary: any[], level: number): Set<number> {
  if (level === 4) return new Set()
  const sorted = [...vocabulary].sort((a, b) => a.importance - b.importance)
  const sliced = sorted.slice(0, level)
  return new Set(sliced.map((v) => v.word_index))
}

// ─── DialogueReview Component ────────────────────────────────────────────────

interface DialogueReviewProps {
  reviews: ReviewItem[]
  allReviews: ReviewItem[]
  fillBlankLevel: number
  onFinish: () => void
}

export default function DialogueReview({
  reviews,
  allReviews,
  fillBlankLevel,
  onFinish,
}: DialogueReviewProps) {
  const token = useAppStore((state) => state.token!)

  const [showChart, setShowChart] = useState(true)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [inputs, setInputs] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [doneCount, setDoneCount] = useState(0)

  // Focus first blank input when starting/switching reviews
  useEffect(() => {
    if (!showChart && reviews.length > 0 && currentIdx < reviews.length) {
      const item = reviews[currentIdx]
      if (!item) return
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
  }, [currentIdx, reviews.length, showChart, fillBlankLevel])

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

  // ─── Dialogue Reviews Start/Dashboard Screen ───────────────────────────────

  if (showChart) {
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

    const todayStr = dates[0] ?? ''
    allReviews.forEach((item) => {
      const itemDate = new Date(item.next_review_at)
      const endOfToday = new Date()
      endOfToday.setHours(23, 59, 59, 999)

      if (itemDate <= endOfToday) {
        grouped[todayStr]?.push(item)
      } else {
        const itemDateStr = itemDate.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
        if (grouped[itemDateStr]) {
          grouped[itemDateStr]?.push(item)
        }
      }
    })

    const maxCount = Math.max(...dates.map((d) => grouped[d]?.length ?? 0), 5)
    const activeIdx = hoveredIdx !== null ? hoveredIdx : 0
    const activeDateStr = dates[activeIdx] ?? ''
    const activeItems = grouped[activeDateStr] || []

    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {/* Line Chart Card */}
        <div className="p-6 rounded-2xl bg-slate-900/20 border border-slate-800/80 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400">未来 7 天听力复习规划统计</span>
            <span className="text-xs text-slate-500">💡 鼠标悬停查看每日句子概要</span>
          </div>
          
          <div className="w-full h-[200px] flex justify-center">
            <svg width="100%" height="200" viewBox="0 0 560 200" className="overflow-visible">
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
                  const yVal = 30 + 130 - ((grouped[d]?.length ?? 0) / maxCount) * 130
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
                const count = grouped[d]?.length ?? 0
                const yVal = 30 + 130 - (count / maxCount) * 130
                const isActive = activeIdx === i

                return (
                  <g key={i}>
                    <circle
                      cx={xVal}
                      cy={yVal}
                      r="18"
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIdx(i)}
                    />
                    <circle
                      cx={xVal}
                      cy={yVal}
                      r={isActive ? "7" : "5"}
                      fill={isActive ? "#c084fc" : "#3b82f6"}
                      stroke="#020617"
                      strokeWidth="2"
                      className="pointer-events-none transition-all duration-150"
                    />
                    <text
                      x={xVal}
                      y={yVal - 10}
                      textAnchor="middle"
                      fill={isActive ? "#c084fc" : "#94a3b8"}
                      fontSize="10"
                      fontWeight="bold"
                      className="pointer-events-none transition-all duration-150"
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
        <div className="flex flex-col gap-3">
          <h3 className="m-0 text-sm text-slate-400 font-semibold">
            {activeIdx === 0 ? '今日待复戏句子的概要' : `${activeDateStr} 计划复习句子的概要`}
          </h3>
          
          <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
            {activeItems.length === 0 ? (
              <div className="py-8 px-4 text-center bg-slate-950/30 border border-slate-900 rounded-xl flex justify-center text-slate-600 text-sm">
                此日期没有计划复习的句子
              </div>
            ) : (
              activeItems.map((item: ReviewItem, idx: number) => (
                <div key={item.id || idx} className="p-3 rounded-xl bg-slate-950/50 border border-slate-900 flex justify-between items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-slate-200 leading-normal">
                      {item.translation}
                    </span>
                    <span className="text-xs text-slate-600">
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
        <div className="flex justify-center mt-2">
          {reviews.length > 0 ? (
            <button
              onClick={() => setShowChart(false)}
              className="w-full py-4 px-8 rounded-2xl border-0 bg-gradient-to-r from-blue-500 to-violet-500 text-white font-bold text-base cursor-pointer shadow-lg shadow-violet-500/20 transition-all duration-150 hover:opacity-95"
            >
              🚀 开始今日听力复习 ({reviews.length} 句)
            </button>
          ) : (
            <div className="flex flex-col gap-3 w-full">
              <div className="w-full p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center text-green-300 text-sm">
                🎉 太棒了！今天所有的听写复习都已完成！
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Dialogue Reviews Active Exercises ─────────────────────────────────────

  if (reviews.length === 0) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-6">
        <div className="text-5xl">🎉</div>
        <h2 className="text-slate-100 font-bold text-xl">暂无需要复习的内容</h2>
        <p className="text-slate-400">继续保持，明天再来！</p>
        <button
          onClick={onFinish}
          className="py-3 px-8 rounded-xl border-0 bg-gradient-to-r from-blue-500 to-violet-500 text-white font-bold cursor-pointer hover:opacity-90 transition-opacity"
        >
          返回主页
        </button>
      </div>
    )
  }

  if (currentIdx >= reviews.length) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-6">
        <div className="text-5xl">🎉</div>
        <h2 className="text-slate-100 font-bold text-xl">复习完成！</h2>
        <p className="text-slate-400">共复习 {doneCount} 句</p>
        <button
          onClick={onFinish}
          className="py-3 px-8 rounded-xl border-0 bg-gradient-to-r from-blue-500 to-violet-500 text-white font-bold cursor-pointer hover:opacity-90 transition-opacity"
        >
          返回主页
        </button>
      </div>
    )
  }

  const item = reviews[currentIdx]

  if (!item) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        无可用复习句数据
      </div>
    )
  }

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
    <div className="flex flex-col w-full">
      {/* Exercise Sub-header */}
      <div className="flex items-center justify-between mb-6 bg-slate-900/30 px-4 py-3 rounded-xl border border-slate-800/80">
        <div>
          <span className="text-slate-400 text-sm">🔄 听写复习</span>
          <span className="text-slate-500 text-xs ml-2">{currentIdx + 1} / {reviews.length}</span>
        </div>
        <button
          onClick={() => setShowChart(true)}
          className="py-1.5 px-3 rounded-lg border border-slate-700 bg-transparent text-slate-500 text-xs cursor-pointer hover:border-slate-500 hover:text-slate-300 transition-colors"
        >
          查看计划
        </button>
      </div>

      <div className="w-full flex justify-center">
        <div className="w-full max-w-[600px]">
          <div className="rounded-2xl p-7 border border-violet-500/25 bg-violet-950/30">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-violet-400">复习 #{item.review_count + 1}</span>
              <AudioControls audioPath={item.audio_path} lineIdx={currentIdx} />
            </div>

            <p className="text-slate-200 text-lg mb-6 font-medium leading-relaxed">
              💬 {item.translation}
            </p>

            {item.audio_path && (
              <p className="text-slate-550 text-xs mb-3">
                💡 提示：可以先点 🔊 听读音再填写
              </p>
            )}

            {/* Fill-blank area */}
            <div className="flex flex-wrap gap-x-2.5 gap-y-2 items-center leading-relaxed mt-6 mb-6">
              {tokens.map((tok, idx) => {
                const { prefix, clean, suffix } = splitToken(tok)
                if (blankIndices.has(idx)) {
                  const given = inputs[idx] ?? ''
                  const correct = given.trim().toLowerCase() === clean.toLowerCase()
                  return (
                    <span key={idx} className="inline-flex items-center gap-0.5">
                      {prefix && <span className="text-slate-200 text-2xl">{prefix}</span>}
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
                        }}
                        className={`py-1 px-2 rounded text-lg text-center outline-none transition-all duration-150 ${
                          submitted
                            ? correct
                              ? 'border-2 border-green-500 bg-green-500/10 text-slate-100'
                              : 'border-2 border-red-500 bg-red-500/10 text-slate-100'
                            : 'border border-dashed border-violet-500/60 bg-violet-500/15 text-slate-100'
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

            {submitted && (
              <div className={`mt-4 p-3 rounded-lg border text-sm font-semibold ${
                isCorrect
                  ? 'bg-green-500/10 border-green-500/30 text-green-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}>
                {isCorrect ? '✅ 正确！' : `❌ 正确答案：${item.original_text}`}
              </div>
            )}
          </div>

          <div className="mt-5 flex gap-3">
            {currentIdx > 0 && (
              <button
                id="btn-prev-review"
                onClick={handlePrev}
                className="py-3.5 px-6 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-400 font-bold text-sm cursor-pointer hover:bg-slate-700/40 hover:text-slate-200 transition-all duration-150"
              >
                ← 上一句
              </button>
            )}
            {!submitted ? (
              <button
                id="btn-submit-review"
                onClick={handleSubmit}
                className="flex-1 py-3.5 rounded-xl border-0 bg-gradient-to-r from-blue-500 to-violet-500 text-white font-bold text-sm cursor-pointer shadow-lg shadow-blue-500/25 transition-opacity hover:opacity-90"
              >
                提交
              </button>
            ) : (
              <button
                id="btn-next-review"
                onClick={handleNext}
                className="flex-1 py-3.5 rounded-xl border border-violet-500/40 bg-violet-500/15 text-violet-300 font-bold text-sm cursor-pointer hover:bg-violet-500/25 transition-all duration-150"
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
