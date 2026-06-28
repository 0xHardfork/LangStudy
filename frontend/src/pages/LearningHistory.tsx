import { useState, useEffect, useCallback } from 'react'
import { listDialogues, getDialogue } from '../services/api'
import type { Dialogue } from '../types'
import { LANGUAGE_LABELS, LEVEL_LABELS } from '../types'
import { useAppStore } from '../store/useAppStore'
import { useRequest } from '../hooks/useRequest'

interface Props {
  onSelectDialogue: (dialogue: Dialogue) => void
  onBack: () => void
}

export default function LearningHistory({ onSelectDialogue, onBack }: Props) {
  const token = useAppStore(state => state.token!)
  const [dialogues, setDialogues] = useState<Dialogue[]>([])
  const [fetchingDetailId, setFetchingDetailId] = useState<number | null>(null)

  // 1. Load History List
  const fetchList = useCallback(() => listDialogues(token), [token])
  const { loading, error: listError, run: loadHistory } = useRequest(fetchList, {
    onSuccess: (data) => {
      const sorted = [...data].sort((a, b) => b.id - a.id)
      setDialogues(sorted)
    }
  })

  // 2. Load Specific Detail
  const fetchDetail = useCallback((id: number) => getDialogue(token, id), [token])
  const { error: detailError, run: runLoadDetail } = useRequest(fetchDetail, {
    onSuccess: (fullDialogue) => {
      onSelectDialogue(fullDialogue)
      setFetchingDetailId(null)
    },
    onError: () => {
      setFetchingDetailId(null)
    }
  })

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const handleStartReview = (id: number) => {
    setFetchingDetailId(id)
    runLoadDetail(id)
  }

  const error = listError || detailError

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 bg-transparent border border-slate-800 rounded-lg py-1.5 px-3 text-slate-400 text-sm font-semibold cursor-pointer hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            ← 返回主页
          </button>
          <h2 className="text-xl font-bold m-0 bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            学习历史记录
          </h2>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-slate-800 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : dialogues.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/20 rounded-2xl border border-slate-850">
            <div className="text-5xl mb-3">📚</div>
            <p className="text-slate-500 text-sm m-0">暂无学习历史，快去生成对话开始学习吧！</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {dialogues.map((d) => {
              const formattedDate = new Date(d.created_at).toLocaleString('zh-CN', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
              const isFetching = fetchingDetailId === d.id

              return (
                <div
                  key={d.id}
                  className="bg-slate-900/40 backdrop-blur-md border border-slate-850 rounded-2xl p-5 flex items-center justify-between gap-4 transition-all duration-150 hover:border-slate-800 hover:bg-slate-900/60"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-xl shrink-0">
                      {'💬'}
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold text-slate-100 m-0 mb-1">
                        {d.topic}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{LANGUAGE_LABELS[d.language] ?? d.language}</span>
                        <span>•</span>
                        <span>{LEVEL_LABELS[d.level] ?? d.level}</span>
                        <span>•</span>
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartReview(d.id)}
                    disabled={fetchingDetailId !== null}
                    className={`py-2 px-4 rounded-lg border-0 text-white text-xs font-semibold cursor-pointer transition-all duration-150 ${
                      isFetching
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-500 to-violet-500 hover:opacity-95 shadow-md shadow-blue-500/10'
                    }`}
                  >
                    {isFetching ? '加载中...' : '回顾练习'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
