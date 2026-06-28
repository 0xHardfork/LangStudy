import { useState } from 'react'
import type { GrammarQuizReviewDetail } from '../../types'
import { submitGrammarAnswer } from '../../services/api'
import { AudioControls } from '../common/AudioPlayer'
import { useAppStore } from '../../store/useAppStore'

interface GrammarReviewProps {
  grammarReviews: GrammarQuizReviewDetail[]
  onFinish: () => void
}

export default function GrammarReview({ grammarReviews, onFinish }: GrammarReviewProps) {
  const token = useAppStore((state) => state.token!)

  const [showGrammarStart, setShowGrammarStart] = useState(true)
  const [grammarIdx, setGrammarIdx] = useState(0)
  const [grammarSelectedOption, setGrammarSelectedOption] = useState<number | null>(null)
  const [grammarIsCorrect, setGrammarIsCorrect] = useState<boolean | null>(null)
  const [grammarSubmitted, setGrammarSubmitted] = useState(false)
  const [grammarDoneCount, setGrammarDoneCount] = useState(0)

  const handleSelectOption = async (optionIdx: number) => {
    if (grammarSubmitted) return
    const item = grammarReviews[grammarIdx]
    if (!item) return
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

  // ─── Grammar Reviews Start/Dashboard Screen ───────────────────────────────

  if (showGrammarStart) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {/* Review list or stats */}
        <div className="p-6 rounded-2xl bg-slate-900/20 border border-slate-800/80 text-center">
          <div className="text-4xl mb-3">🧠</div>
          <h3 className="text-lg font-bold m-0 mb-2 text-slate-100">
            语法错题填空计划
          </h3>
          <p className="text-sm text-slate-400 m-0">
            今天有 <strong>{grammarReviews.length}</strong> 道语法错题需要复习巩固
          </p>
        </div>

        {/* Due items summary */}
        <div className="flex flex-col gap-3">
          <h4 className="m-0 text-sm text-slate-500 font-semibold uppercase tracking-wider">
            待复习题概要
          </h4>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
            {grammarReviews.length === 0 ? (
              <div className="p-8 text-center text-slate-600 text-sm bg-slate-950/30 border border-slate-900 rounded-xl">
                暂无需要复习的语法单选
              </div>
            ) : (
              grammarReviews.map((item, idx) => (
                <div key={item.grammar_quiz_id || idx} className="p-3 rounded-xl bg-slate-950/50 border border-slate-900 flex flex-col gap-1.5">
                  <span className="text-sm text-slate-200 font-semibold leading-normal">
                    {idx + 1}. {item.question}
                  </span>
                  <span className="text-xs text-slate-500">
                    原句释义: {item.sentence_trans}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-center mt-2">
          {grammarReviews.length > 0 ? (
            <button
              onClick={() => setShowGrammarStart(false)}
              className="w-full py-4 px-8 rounded-2xl border-0 bg-gradient-to-r from-blue-500 to-violet-500 text-white font-bold text-base cursor-pointer shadow-lg shadow-violet-500/20 transition-all duration-150 hover:opacity-95"
            >
              🚀 开始语法复习 ({grammarReviews.length} 题)
            </button>
          ) : (
            <div className="w-full p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center text-green-300 text-sm">
              🎉 太棒了！所有的语法题复习均已完成！
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Grammar Reviews Active Panel ──────────────────────────────────────────

  if (grammarReviews.length === 0) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-6">
        <div className="text-5xl">🎉</div>
        <h2 className="text-slate-100 font-bold text-xl">暂无需要复习的语法题</h2>
        <button
          onClick={onFinish}
          className="py-3 px-8 rounded-xl border-0 bg-gradient-to-r from-blue-500 to-violet-500 text-white font-bold cursor-pointer hover:opacity-90 transition-opacity"
        >
          返回主页
        </button>
      </div>
    )
  }

  if (grammarIdx >= grammarReviews.length) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-6">
        <div className="text-5xl">🎉</div>
        <h2 className="text-slate-100 font-bold text-xl">语法复习完成！</h2>
        <p className="text-slate-400">共复习 {grammarDoneCount} 道题</p>
        <button
          onClick={onFinish}
          className="py-3 px-8 rounded-xl border-0 bg-gradient-to-r from-blue-500 to-violet-500 text-white font-bold cursor-pointer hover:opacity-90 transition-opacity"
        >
          返回主页
        </button>
      </div>
    )
  }

  const item = grammarReviews[grammarIdx]

  if (!item) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        无可用复习题数据
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full">
      {/* Active Exercise Sub-header */}
      <div className="flex items-center justify-between mb-6 bg-slate-900/30 px-4 py-3 rounded-xl border border-slate-800/80">
        <div>
          <span className="text-slate-400 text-sm">🧠 语法错题复习</span>
          <span className="text-slate-500 text-xs ml-2">{grammarIdx + 1} / {grammarReviews.length}</span>
        </div>
        <button
          onClick={() => setShowGrammarStart(true)}
          className="py-1.5 px-3 rounded-lg border border-slate-700 bg-transparent text-slate-500 text-xs cursor-pointer hover:border-slate-500 hover:text-slate-355 transition-colors"
        >
          查看计划
        </button>
      </div>

      <div className="w-full flex justify-center">
        <div className="w-full max-w-[600px] flex flex-col gap-6">
          
          {/* Original Sentence Audio & Context Card */}
          <div className="rounded-2xl p-5 border border-slate-800 bg-slate-900/10">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-violet-405 font-semibold">原句发音与释义</span>
              {item.audio_path && <AudioControls audioPath={item.audio_path} lineIdx={grammarIdx + 2000} />}
            </div>
            <div className="text-sm text-slate-300 italic mb-2">
              💬 {item.sentence_trans}
            </div>
            {grammarSubmitted && (
              <div className="text-xs text-slate-450 bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                <strong>语法深度讲解：</strong>{item.sentence_explain}
              </div>
            )}
          </div>

          {/* Quiz Card */}
          <div className="rounded-2xl p-6 border border-violet-500/25 bg-violet-950/20">
            <div className="text-lg text-slate-100 font-semibold leading-relaxed mb-5">
              {item.question}
            </div>

            {/* Options list */}
            <div className="flex flex-col gap-2.5">
              {item.options.map((opt, idx) => {
                const isSelected = grammarSelectedOption === idx
                const isCorrectOpt = item.correct_option === idx
                let optClass = 'bg-slate-950/40 border border-slate-800/80 text-slate-300 cursor-pointer hover:bg-violet-500/10 hover:border-violet-500/40'

                if (grammarSubmitted) {
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
                    disabled={grammarSubmitted}
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full py-3.5 px-4 rounded-xl text-left text-sm font-medium transition-colors duration-150 outline-none ${optClass}`}
                  >
                    <strong className="mr-2">{String.fromCharCode(65 + idx)}.</strong> {opt}
                  </button>
                )
              })}
            </div>

            {/* Explanations section */}
            {grammarSubmitted && (
              <div className={`mt-5 p-4 rounded-xl border flex flex-col gap-3 ${
                grammarIsCorrect
                  ? 'bg-green-500/5 border-green-500/20'
                  : 'bg-red-500/5 border-red-500/20'
              }`}>
                <div className={`font-bold text-sm ${grammarIsCorrect ? 'text-green-300' : 'text-red-300'}`}>
                  {grammarIsCorrect ? '✅ 答对了！' : `❌ 答错了，正确答案是 ${String.fromCharCode(65 + item.correct_option)}`}
                </div>

                <div className="flex flex-col gap-2 text-xs">
                  <span className="font-semibold text-slate-500">选项解析：</span>
                  {item.options.map((opt, idx) => {
                    const explain = (item.explanations as any)[idx]
                    const isCorrectOpt = item.correct_option === idx
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

          {grammarSubmitted && (
            <button
              id="btn-next-grammar-review"
              onClick={handleNextGrammar}
              className="w-full py-4 px-8 rounded-xl border border-violet-500/40 bg-violet-500/15 text-violet-300 font-bold text-sm cursor-pointer hover:bg-violet-500/25 transition-all duration-150"
            >
              {grammarIdx + 1 >= grammarReviews.length ? '完成复习 🎉' : '下一题 →'}
            </button>
          )}

        </div>
      </div>
    </div>
  )
}
