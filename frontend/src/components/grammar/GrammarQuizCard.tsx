import { useState, useEffect } from 'react'
import type { GrammarQuiz } from '../../types'
import { submitGrammarAnswer } from '../../services/api'
import { useAppStore } from '../../store/useAppStore'

interface GrammarQuizCardProps {
  quiz: GrammarQuiz
}

export default function GrammarQuizCard({ quiz }: GrammarQuizCardProps) {
  const token = useAppStore((state) => state.token!)
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
    <div className="p-5 rounded-2xl bg-slate-900/25 border border-violet-500/20 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-violet-400 font-semibold tracking-wider">
          🧠 完形填空专项检测 (Cloze Quiz)
        </span>
        {quiz.tags && quiz.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {quiz.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-2 py-0.5 rounded bg-violet-500/15 border border-violet-500/30 text-violet-300"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="text-lg text-slate-100 font-semibold leading-normal">
        {quiz.question}
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 gap-2">
        {quiz.options.map((opt, idx) => {
          const isSelected = selectedIdx === idx
          const isCorrectOpt = quiz.correct_option === idx
          let optClass = 'bg-slate-950/40 border border-slate-800/80 text-slate-350 cursor-pointer hover:bg-violet-500/10 hover:border-violet-500/40'

          if (selectedIdx !== null) {
            if (isCorrectOpt) {
              optClass = 'bg-green-500/15 border border-green-500 text-green-300 cursor-not-allowed'
            } else if (isSelected) {
              optClass = 'bg-red-500/15 border border-red-500 text-red-300 cursor-not-allowed'
            } else {
              optClass = 'bg-slate-950/40 border border-slate-800/80 text-slate-500 cursor-not-allowed'
            }
          }

          return (
            <button
              key={idx}
              disabled={selectedIdx !== null}
              onClick={() => handleSelect(idx)}
              className={`w-full py-3 px-4 rounded-xl text-left text-sm font-medium transition-colors duration-150 outline-none ${optClass}`}
            >
              <strong className="mr-2">{String.fromCharCode(65 + idx)}.</strong> {opt}
            </button>
          )
        })}
      </div>

      {/* Explanations Section */}
      {selectedIdx !== null && (
        <div
          className={`mt-2 p-4 rounded-xl border flex flex-col gap-3 ${
            isCorrect
              ? 'bg-green-500/5 border-green-500/20'
              : 'bg-red-500/5 border-red-500/20'
          }`}
        >
          <div className={`font-bold text-sm ${isCorrect ? 'text-green-300' : 'text-red-300'}`}>
            {isCorrect ? '✅ 答对了！' : `❌ 答错了，正确答案是 ${String.fromCharCode(65 + quiz.correct_option)}`}
          </div>

          <div className="flex flex-col gap-2 text-xs">
            <span className="font-semibold text-slate-500">选项解析：</span>
            {quiz.options.map((opt, idx) => {
              const explain = (quiz.explanations as any)[idx]
              const isCorrectOpt = quiz.correct_option === idx
              return (
                <div
                  key={idx}
                  className={`text-slate-300 leading-normal pl-2 border-l-2 ${
                    isCorrectOpt ? 'border-green-500' : 'border-slate-700'
                  }`}
                >
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
