import React, { useState } from 'react'
import type { GrammarArticle } from '../../types'

interface GrammarArticleListProps {
  history: GrammarArticle[]
  loadingHistory: boolean
  analyzing: boolean
  error: string | null
  onStartAnalysis: (title: string, text: string) => Promise<void>
  onLoadArticle: (id: number) => void
  onRefreshHistory: () => void
}

export default function GrammarArticleList({
  history,
  loadingHistory,
  analyzing,
  error,
  onStartAnalysis,
  onLoadArticle,
  onRefreshHistory,
}: GrammarArticleListProps) {
  const [titleInput, setTitleInput] = useState('')
  const [textInput, setTextInput] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titleInput.trim() || !textInput.trim() || analyzing) return
    await onStartAnalysis(titleInput, textInput)
    setTitleInput('')
    setTextInput('')
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Input Form Card */}
      <div className="p-6 rounded-2xl bg-slate-900/25 border border-slate-800/80 flex flex-col gap-5">
        <h2 className="m-0 text-xl font-bold text-slate-100">
          ✏️ 新增英文分析
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] text-slate-400 font-semibold">文章标题</label>
            <input
              type="text"
              required
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="例如: Attributive Clause Study"
              className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-100 text-sm outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] text-slate-400 font-semibold">英文内容 (支持长文或句子)</label>
            <textarea
              required
              rows={8}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="请粘贴或输入你想分析的英文段落..."
              className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-100 text-sm outline-none focus:border-blue-500/50 transition-colors resize-y leading-relaxed"
            />
          </div>

          {error && (
            <div className="text-red-450 text-xs font-semibold">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={analyzing}
            className="p-3.5 rounded-xl border-0 bg-gradient-to-r from-blue-500 to-violet-500 text-white font-bold text-sm cursor-pointer shadow-lg shadow-blue-500/20 hover:opacity-95 disabled:bg-blue-500/30 disabled:cursor-not-allowed transition-all"
          >
            {analyzing ? 'AI 正在深度语法分析中...' : '🚀 开始语法分析'}
          </button>
        </form>
      </div>

      {/* History List Card */}
      <div className="p-6 rounded-2xl bg-slate-900/25 border border-slate-800/80 flex flex-col gap-4 max-h-[520px]">
        <h2 className="m-0 text-xl font-bold text-slate-100 flex justify-between items-center">
          <span>📚 共享语法库历史</span>
          <button
            onClick={onRefreshHistory}
            className="bg-transparent border-0 text-blue-400 cursor-pointer text-sm font-semibold hover:text-blue-300 transition-colors"
          >
            刷新
          </button>
        </h2>

        <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
          {loadingHistory ? (
            <div className="text-slate-500 text-sm text-center mt-8">加载历史记录中...</div>
          ) : history.length === 0 ? (
            <div className="text-slate-550 text-sm text-center mt-8">暂无历史分析，赶紧上传第一篇吧！</div>
          ) : (
            history.map((art) => (
              <div
                key={art.id}
                onClick={() => onLoadArticle(art.id)}
                className="p-4 rounded-xl bg-slate-950/40 border border-slate-900 cursor-pointer transition-all duration-150 hover:border-blue-500/40 hover:bg-slate-900/40"
              >
                <div className="font-semibold text-sm text-slate-200 mb-1">
                  {art.title}
                </div>
                <div className="text-xs text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap mb-2">
                  {art.raw_text}
                </div>
                <div className="text-[11px] text-slate-600">
                  📅 上传于 {new Date(art.created_at).toLocaleString('zh-CN')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
