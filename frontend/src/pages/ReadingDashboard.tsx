import { useState, useEffect, useCallback } from 'react'
import type { ReadingArticle } from '../types'
import { createReadingArticle, getReadingHistory, getReadingArticle } from '../services/api'
import { useAppStore } from '../store/useAppStore'
import { useRequest } from '../hooks/useRequest'
import ReadingArticleDetail from '../components/reading/ReadingArticleDetail'

interface Props {
  onBack: () => void
}

export default function ReadingDashboard({ onBack }: Props) {
  const token = useAppStore((state) => state.token!)
  const [history, setHistory] = useState<ReadingArticle[]>([])
  const [activeArticle, setActiveArticle] = useState<ReadingArticle | null>(null)
  const [activeSentIdx, setActiveSentIdx] = useState<number | null>(null)

  // 1. Fetch History Request
  const fetchHistory = useCallback(() => getReadingHistory(token), [token])
  const { loading: loadingHistory, run: loadHistory } = useRequest(fetchHistory, {
    onSuccess: setHistory,
  })

  // 2. Start Analysis Request
  const startAnalysis = useCallback(
    (title: string, text: string) => createReadingArticle(token, title, text),
    [token]
  )
  const { loading: analyzing, error, run: runAnalysis } = useRequest(startAnalysis, {
    onSuccess: (result) => {
      setActiveArticle(result)
      setActiveSentIdx(0) // auto-select first sentence
      loadHistory() // refresh history list
    },
  })

  // 3. Load Article Details Request
  const fetchArticle = useCallback((id: number) => getReadingArticle(token, id), [token])
  const { run: runLoadArticle } = useRequest(fetchArticle, {
    onSuccess: (result) => {
      setActiveArticle(result)
      if (result.sentences && result.sentences.length > 0) {
        setActiveSentIdx(0)
      }
    },
    onError: (err) => {
      alert('加载长文失败: ' + err.message)
    },
  })

  // Load history on mount
  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Form input states
  const [titleInput, setTitleInput] = useState('')
  const [textInput, setTextInput] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titleInput.trim() || analyzing) return
    await runAnalysis(titleInput, textInput)
    setTitleInput('')
    setTextInput('')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">📚</span>
          <span className="font-bold text-lg bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            英语长文阅读与语法深度解析
          </span>
        </div>
        <button
          onClick={onBack}
          className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-400 text-xs font-semibold cursor-pointer hover:bg-slate-700/50 hover:text-slate-200 transition-all duration-150"
        >
          🏠 回到首页
        </button>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {!activeArticle ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Input Form */}
            <div className="p-6 rounded-2xl bg-slate-900/25 border border-slate-800/80 flex flex-col gap-5">
              <h2 className="m-0 text-xl font-bold text-slate-100">
                ✏️ 上传分析新文章
              </h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] text-slate-400 font-semibold">文章标题</label>
                  <input
                    type="text"
                    required
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder="例如: The Road Not Taken"
                    className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-100 text-sm outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] text-slate-400 font-semibold">英文长文内容 (可选，可直接提交后逐句添加)</label>
                  <textarea
                    rows={12}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="在此粘贴或输入您的英文文章，建议控制在 5000 字符以内。留空则只创建主题，可在详情中追加句子..."
                    className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-100 text-sm outline-none focus:border-blue-500/50 transition-colors resize-y leading-relaxed"
                  />
                </div>

                {error && (
                  <div className="text-red-400 text-xs font-semibold">
                    ⚠️ {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={analyzing}
                  className="p-3.5 rounded-xl border-0 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold text-sm cursor-pointer shadow-lg shadow-blue-500/20 hover:opacity-95 disabled:bg-blue-500/30 disabled:cursor-not-allowed transition-all"
                >
                  {analyzing ? 'AI 正在深度解析中，大约需要15秒...' : '🚀 开始阅读深度解析'}
                </button>
              </form>
            </div>

            {/* History List */}
            <div className="p-6 rounded-2xl bg-slate-900/25 border border-slate-800/80 flex flex-col gap-4 max-h-[600px]">
              <h2 className="m-0 text-xl font-bold text-slate-100 flex justify-between items-center">
                <span>📚 个人长文库历史</span>
                <button
                  onClick={loadHistory}
                  className="bg-transparent border-0 text-blue-400 cursor-pointer text-sm font-semibold hover:text-blue-300 transition-colors"
                >
                  刷新
                </button>
              </h2>

              <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
                {loadingHistory ? (
                  <div className="text-slate-500 text-sm text-center mt-8">加载历史记录中...</div>
                ) : history.length === 0 ? (
                  <div className="text-slate-500 text-sm text-center mt-8">暂无分析历史，快上传你的第一篇文章吧！</div>
                ) : (
                  history.map((art) => (
                    <div
                      key={art.id}
                      onClick={() => runLoadArticle(art.id)}
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
        ) : (
          <ReadingArticleDetail
            activeArticle={activeArticle}
            activeSentIdx={activeSentIdx}
            setActiveSentIdx={setActiveSentIdx}
            onBackToList={() => setActiveArticle(null)}
            onArticleUpdate={setActiveArticle}
          />
        )}
      </main>
    </div>
  )
}
