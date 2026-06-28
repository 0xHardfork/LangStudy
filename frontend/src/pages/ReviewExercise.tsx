import { useState, useEffect, useCallback } from 'react'
import type { ReviewItem, GrammarQuizReviewDetail } from '../types'
import { getDueReviews, getReviewSchedule, getDueGrammarReviews } from '../services/api'
import { useAppStore } from '../store/useAppStore'
import { useRequest } from '../hooks/useRequest'
import DialogueReview from '../components/review/DialogueReview'
import GrammarReview from '../components/review/GrammarReview'

interface Props {
  fillBlankLevel: number
  onFinish: () => void
}

export default function ReviewExercise({ fillBlankLevel, onFinish }: Props) {
  const token = useAppStore((state) => state.token!)
  const [reviewType, setReviewType] = useState<'dialogue' | 'grammar'>('dialogue')
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [allReviews, setAllReviews] = useState<ReviewItem[]>([])
  const [grammarReviews, setGrammarReviews] = useState<GrammarQuizReviewDetail[]>([])

  const fetchAll = useCallback(() => {
    return Promise.all([
      getDueReviews(token),
      getReviewSchedule(token),
      getDueGrammarReviews(token),
    ])
  }, [token])

  const { loading, error, run: loadData } = useRequest(fetchAll, {
    onSuccess: ([dueData, allData, grammarData]) => {
      setReviews(dueData)
      setAllReviews(allData)
      setGrammarReviews(grammarData)
    }
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-base">加载复习内容...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-red-400">加载失败：{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold m-0 bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            📊 艾宾浩斯复习计划
          </h2>
          <button
            onClick={onFinish}
            className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-transparent text-slate-400 text-xs font-semibold cursor-pointer transition-all duration-150 hover:bg-slate-800 hover:text-slate-200"
          >
            返回主页
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
          <button
            onClick={() => setReviewType('dialogue')}
            className={`flex-1 py-2.5 rounded-lg border-0 text-sm font-semibold cursor-pointer transition-all duration-150 ${
              reviewType === 'dialogue'
                ? 'bg-violet-500/20 text-violet-300'
                : 'bg-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🔄 听力填空 ({reviews.length})
          </button>
          <button
            onClick={() => setReviewType('grammar')}
            className={`flex-1 py-2.5 rounded-lg border-0 text-sm font-semibold cursor-pointer transition-all duration-150 ${
              reviewType === 'grammar'
                ? 'bg-violet-500/20 text-violet-300'
                : 'bg-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🧠 语法单选 ({grammarReviews.length})
          </button>
        </div>

        {reviewType === 'dialogue' ? (
          <DialogueReview
            reviews={reviews}
            allReviews={allReviews}
            fillBlankLevel={fillBlankLevel}
            onFinish={onFinish}
          />
        ) : (
          <GrammarReview
            grammarReviews={grammarReviews}
            onFinish={onFinish}
          />
        )}
      </div>
    </div>
  )
}
