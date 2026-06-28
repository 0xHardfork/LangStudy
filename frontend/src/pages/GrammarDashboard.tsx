import { useState, useEffect, useCallback } from 'react'
import type { GrammarArticle } from '../types'
import { analyzeText, getGrammarHistory, getAnalyzedArticle } from '../services/api'
import { useAppStore } from '../store/useAppStore'
import { useRequest } from '../hooks/useRequest'
import GrammarArticleList from '../components/grammar/GrammarArticleList'
import GrammarArticleDetail from '../components/grammar/GrammarArticleDetail'

interface Props {
  onBack: () => void
}

export default function GrammarDashboard({ onBack }: Props) {
  const token = useAppStore((state) => state.token!)
  const [history, setHistory] = useState<GrammarArticle[]>([])
  const [activeArticle, setActiveArticle] = useState<GrammarArticle | null>(null)
  const [activeSentIdx, setActiveSentIdx] = useState<number | null>(null)

  // 1. Fetch History Request
  const fetchHistory = useCallback(() => getGrammarHistory(token), [token])
  const { loading: loadingHistory, run: loadHistory } = useRequest(fetchHistory, {
    onSuccess: setHistory
  })

  // 2. Start Analysis Request
  const startAnalysis = useCallback(
    (title: string, text: string) => analyzeText(token, title, text),
    [token]
  )
  const { loading: analyzing, error, run: runAnalysis } = useRequest(startAnalysis, {
    onSuccess: (result) => {
      setActiveArticle(result)
      setActiveSentIdx(0) // auto-select first sentence
      loadHistory() // refresh history list
    }
  })

  // 3. Load Article Details Request
  const fetchArticle = useCallback((id: number) => getAnalyzedArticle(token, id), [token])
  const { run: runLoadArticle } = useRequest(fetchArticle, {
    onSuccess: (result) => {
      setActiveArticle(result)
      if (result.sentences && result.sentences.length > 0) {
        setActiveSentIdx(0)
      }
    },
    onError: (err) => {
      alert('加载文章失败: ' + err.message)
    }
  })

  // Load history on mount
  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">📖</span>
          <span className="font-bold text-lg bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            英语语法与文章分析
          </span>
        </div>
        <button
          onClick={onBack}
          className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-400 text-xs font-semibold cursor-pointer hover:bg-slate-700/50 hover:text-slate-200 transition-all duration-150"
        >
          🏠 回到首页
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!activeArticle ? (
          <GrammarArticleList
            history={history}
            loadingHistory={loadingHistory}
            analyzing={analyzing}
            error={error}
            onStartAnalysis={async (title, text) => { await runAnalysis(title, text) }}
            onLoadArticle={async (id) => { await runLoadArticle(id) }}
            onRefreshHistory={loadHistory}
          />
        ) : (
          <GrammarArticleDetail
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
