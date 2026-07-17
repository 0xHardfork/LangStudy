import { useState, useEffect, useCallback } from 'react'
import type { SubtitleTopic } from '../types'
import {
  uploadSubtitle,
  getSubtitleHistory,
  getSubtitleTopic,
  deleteSubtitleTopic,
  processSubtitleTopic,
  mergeSubtitleTopic,
  getSharedSubtitles,
} from '../services/api'
import { useAppStore } from '../store/useAppStore'
import { useRequest } from '../hooks/useRequest'
import { LANGUAGE_LABELS } from '../types'
import SubtitleDetail from '../components/subtitle/SubtitleDetail'

interface Props {
  onBack: () => void
}

export default function SubtitleDashboard({ onBack }: Props) {
  const token = useAppStore((state) => state.token!)
  const user = useAppStore((state) => state.user)
  const learningProfile = useAppStore((state) => state.learningProfile)
  const [history, setHistory] = useState<SubtitleTopic[]>([])
  const [sharedHistory, setSharedHistory] = useState<SubtitleTopic[]>([])
  const [activeTab, setActiveTab] = useState<'my' | 'shared'>('my')
  const [loadingShared, setLoadingShared] = useState(false)
  const [activeTopic, setActiveTopic] = useState<SubtitleTopic | null>(null)
  const [activeSentIdx, setActiveSentIdx] = useState<number | null>(null)
  const [resuming, setResuming] = useState(false)
  const [merging, setMerging] = useState(false)

  const chunks = activeTopic?.chunks || []
  const totalChunks = chunks.length
  const completedCount = chunks.filter((c) => c.status === 'completed').length
  const allCompleted = totalChunks > 0 && completedCount === totalChunks

  const resumeProcessing = async () => {
    if (!activeTopic || resuming) return
    setResuming(true)
    try {
      await processSubtitleTopic(token, activeTopic.id)
      const detailed = await getSubtitleTopic(token, activeTopic.id)
      setActiveTopic(detailed)
    } catch (err: any) {
      alert('启动处理失败: ' + err.message)
    } finally {
      setResuming(false)
    }
  }

  const handleMerge = async () => {
    if (!activeTopic || merging) return
    setMerging(true)
    try {
      await mergeSubtitleTopic(token, activeTopic.id)
      await runLoadDetail(activeTopic.id)
    } catch (err: any) {
      alert('合并失败: ' + err.message)
    } finally {
      setMerging(false)
    }
  }

  useEffect(() => {
    if (!activeTopic || activeTopic.status !== 'pending') return

    const hasFailed = activeTopic.chunks?.some((c) => c.status === 'failed')
    if (hasFailed) return

    const interval = setInterval(async () => {
      try {
        const detailed = await getSubtitleTopic(token, activeTopic.id)
        setActiveTopic(detailed)
      } catch (err) {
        console.error('Failed to poll subtitle progress:', err)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [activeTopic?.id, activeTopic?.status, activeTopic?.chunks, token])

  // 1. Fetch History Request
  const fetchHistory = useCallback(() => getSubtitleHistory(token), [token])
  const { loading: loadingHistory, run: loadHistory } = useRequest(fetchHistory, {
    onSuccess: setHistory,
  })

  const loadShared = useCallback(async () => {
    setLoadingShared(true)
    try {
      const data = await getSharedSubtitles(token)
      setSharedHistory(data)
    } catch (err) {
      console.error('Failed to load shared subtitles:', err)
    } finally {
      setLoadingShared(false)
    }
  }, [token])

  const refreshList = useCallback(() => {
    if (activeTab === 'shared') {
      loadShared()
    } else {
      loadHistory()
    }
  }, [activeTab, loadHistory, loadShared])

  // 2. Upload / Analyze Request
  const [file, setFile] = useState<File | null>(null)
  const [titleInput, setTitleInput] = useState('')
  const [targetLang, setTargetLang] = useState('en')
  const [nativeLang, setNativeLang] = useState('zh')

  useEffect(() => {
    // Set default target lang from profile if exists
    if (learningProfile?.target_languages?.[0]) {
      setTargetLang(learningProfile.target_languages[0].lang)
    }
    if (learningProfile?.native_language) {
      setNativeLang(learningProfile.native_language)
    }
  }, [learningProfile])

  const startUpload = useCallback(
    (f: File, title: string, target: string, native: string) =>
      uploadSubtitle(token, f, title, target, native),
    [token]
  )

  const { loading: analyzing, error, run: runUpload } = useRequest(startUpload, {
    onSuccess: (result) => {
      setActiveTopic(result)
      if (result.sentences && result.sentences.length > 0) {
        setActiveSentIdx(0)
      }
      setActiveTab('my')
      loadHistory()
      setFile(null)
      setTitleInput('')
    },
  })

  // 3. Fetch Detail Request
  const fetchDetail = useCallback((id: number) => getSubtitleTopic(token, id), [token])
  const { run: runLoadDetail } = useRequest(fetchDetail, {
    onSuccess: (result) => {
      setActiveTopic(result)
      if (result.sentences && result.sentences.length > 0) {
        setActiveSentIdx(0)
      }
    },
    onError: (err) => {
      alert('加载字幕详情失败: ' + err.message)
    },
  })

  // 4. Delete Request
  const runDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定要删除这条字幕记录吗？')) return
    try {
      await deleteSubtitleTopic(token, id)
      refreshList()
      if (activeTopic?.id === id) {
        setActiveTopic(null)
      }
    } catch (err: any) {
      alert('删除失败: ' + err.message)
    }
  }

  useEffect(() => {
    loadHistory()
    loadShared()
  }, [loadHistory, loadShared])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || analyzing) return
    await runUpload(file, titleInput.trim(), targetLang, nativeLang)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎬</span>
          <span className="font-bold text-lg bg-gradient-to-r from-rose-400 to-amber-400 bg-clip-text text-transparent">
            视频字幕翻译与语法分析
          </span>
        </div>
        <button
          onClick={onBack}
          className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-400 text-xs font-semibold cursor-pointer hover:bg-slate-700/50 hover:text-slate-200 transition-all"
        >
          🏠 回到首页
        </button>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {!activeTopic ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Upload Form */}
            <div className="p-6 rounded-2xl bg-slate-900/25 border border-slate-800/80 flex flex-col gap-5">
              <h2 className="m-0 text-xl font-bold text-slate-100">🎬 上传新字幕文件</h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] text-slate-400 font-semibold">选择字幕文件 (.srt / .vtt / .ass)</label>
                  <input
                    type="file"
                    required
                    accept=".srt,.vtt,.ass"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null
                      setFile(f)
                      if (f && !titleInput) {
                        setTitleInput(f.name.replace(/\.[^/.]+$/, ''))
                      }
                    }}
                    className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-100 text-sm outline-none cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] text-slate-400 font-semibold">字幕名称 / 标题</label>
                  <input
                    type="text"
                    required
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder="请输入字幕标题"
                    className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-100 text-sm outline-none focus:border-rose-500/50 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] text-slate-400 font-semibold">所学目标语言</label>
                    <select
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                      className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-100 text-sm outline-none focus:border-rose-500/50 transition-colors"
                    >
                      {Object.entries(LANGUAGE_LABELS).map(([k, v]) => (
                        <option key={k} value={k} className="bg-slate-900">{v}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] text-slate-400 font-semibold">您的母语</label>
                    <select
                      value={nativeLang}
                      onChange={(e) => setNativeLang(e.target.value)}
                      className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-100 text-sm outline-none focus:border-rose-500/50 transition-colors"
                    >
                      <option value="zh" className="bg-slate-900">中文</option>
                      <option value="en" className="bg-slate-900">英语</option>
                    </select>
                  </div>
                </div>

                {error && <div className="text-red-400 text-xs font-semibold">⚠️ {error}</div>}

                <button
                  type="submit"
                  disabled={analyzing || !file}
                  className="p-3.5 rounded-xl border-0 bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-sm cursor-pointer shadow-lg shadow-rose-500/20 hover:opacity-95 disabled:from-rose-950/20 disabled:to-amber-950/20 disabled:cursor-not-allowed transition-all"
                >
                  {analyzing ? 'AI 正在翻译与分析中，请稍候...' : '🚀 开始翻译并深度分析'}
                </button>
              </form>
            </div>

            {/* History list */}
            <div className="p-6 rounded-2xl bg-slate-900/25 border border-slate-800/80 flex flex-col gap-4 max-h-[600px]">
              <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setActiveTab('my')
                      loadHistory()
                    }}
                    className={`pb-2 text-sm font-bold border-b-2 cursor-pointer transition-all ${
                      activeTab === 'my'
                        ? 'border-rose-500 text-rose-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    📚 我的字幕 ({history.length})
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('shared')
                      loadShared()
                    }}
                    className={`pb-2 text-sm font-bold border-b-2 cursor-pointer transition-all ${
                      activeTab === 'shared'
                        ? 'border-rose-500 text-rose-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🌐 共享字幕库 ({sharedHistory.length})
                  </button>
                </div>
                <button
                  onClick={refreshList}
                  className="bg-transparent border-0 text-rose-400 cursor-pointer text-sm font-semibold hover:text-rose-300 transition-colors"
                >
                  刷新
                </button>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
                {activeTab === 'my' ? (
                  loadingHistory ? (
                    <div className="text-slate-500 text-sm text-center mt-8">加载历史记录中...</div>
                  ) : history.length === 0 ? (
                    <div className="text-slate-500 text-sm text-center mt-8">暂无字幕历史，快上传你的第一个字幕吧！</div>
                  ) : (
                    history.map((topic) => (
                      <div
                        key={topic.id}
                        onClick={() => runLoadDetail(topic.id)}
                        className="p-4 rounded-xl bg-slate-950/40 border border-slate-900 cursor-pointer transition-all hover:border-rose-500/40 hover:bg-slate-900/40 flex justify-between items-start"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-slate-200 mb-1 truncate">
                            {topic.title}
                          </div>
                          <div className="text-xs text-slate-500 mb-2 truncate flex items-center gap-1.5">
                            <span className="truncate">文件：{topic.original_file_name}</span>
                            {topic.is_shared && <span className="text-[10px] bg-emerald-950/60 text-emerald-400 px-1 py-0.5 rounded font-medium shrink-0">已分享</span>}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            📅 创建于 {new Date(topic.created_at).toLocaleString('zh-CN')}
                          </div>
                        </div>
                        <button
                          onClick={(e) => runDelete(topic.id, e)}
                          className="p-1 px-2 text-xs border border-slate-800/80 bg-slate-950/30 text-slate-500 rounded hover:border-red-500/40 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          删除
                        </button>
                      </div>
                    ))
                  )
                ) : (
                  loadingShared ? (
                    <div className="text-slate-500 text-sm text-center mt-8">加载共享字幕库中...</div>
                  ) : sharedHistory.length === 0 ? (
                    <div className="text-slate-500 text-sm text-center mt-8">字幕库暂无共享内容，你可以分享自己的解析哦！</div>
                  ) : (
                    sharedHistory.map((topic) => {
                      const isOwner = topic.user_id === user?.id
                      return (
                        <div
                          key={topic.id}
                          onClick={() => runLoadDetail(topic.id)}
                          className="p-4 rounded-xl bg-slate-950/40 border border-slate-900 cursor-pointer transition-all hover:border-rose-500/40 hover:bg-slate-900/40 flex justify-between items-start"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm text-slate-200 mb-1 truncate">
                              {topic.title}
                            </div>
                            <div className="text-xs text-slate-500 mb-2 truncate">
                              文件：{topic.original_file_name}
                            </div>
                            <div className="text-[11px] text-slate-600">
                              📅 创建于 {new Date(topic.created_at).toLocaleString('zh-CN')}
                            </div>
                          </div>
                          {isOwner && (
                            <button
                              onClick={(e) => runDelete(topic.id, e)}
                              className="p-1 px-2 text-xs border border-slate-800/80 bg-slate-950/30 text-slate-500 rounded hover:border-red-500/40 hover:text-red-400 transition-colors cursor-pointer"
                            >
                              删除
                            </button>
                          )}
                        </div>
                      )
                    })
                  )
                )}
              </div>
            </div>
          </div>
        ) : activeTopic.status === 'pending' ? (
          <div className="max-w-3xl mx-auto p-6 rounded-2xl bg-slate-900/25 border border-slate-800/80 flex flex-col gap-6 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h2 className="m-0 text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span>🎬</span> 字幕分块处理进度
                </h2>
                <p className="text-xs text-slate-500 mt-1">视频：{activeTopic.original_file_name}</p>
              </div>
              <button
                onClick={() => {
                  setActiveTopic(null)
                  loadHistory()
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/30 text-slate-400 text-xs font-semibold cursor-pointer hover:bg-slate-700/50 hover:text-slate-200 transition-all"
              >
                返回字幕库列表
              </button>
            </div>

            {/* Progress Summary Card */}
            <div className="p-4 rounded-xl bg-slate-950/30 border border-slate-800/60">
              <div className="flex justify-between items-center text-sm font-semibold text-slate-300 mb-2">
                <span>处理进度：{completedCount} / {totalChunks} 分块</span>
                <span className="text-rose-400 font-mono">{Math.round((completedCount / (totalChunks || 1)) * 100)}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-300"
                  style={{ width: `${(completedCount / (totalChunks || 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Chunks Checklist */}
            <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
              {activeTopic.chunks?.map((chunk) => {
                const isFailed = chunk.status === 'failed'
                const isProcessing = chunk.status === 'processing'
                const isCompleted = chunk.status === 'completed'

                return (
                  <div
                    key={chunk.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                      isProcessing
                        ? 'border-amber-500/40 bg-amber-500/5 shadow-sm shadow-amber-500/2'
                        : isCompleted
                        ? 'border-emerald-500/20 bg-emerald-500/5'
                        : isFailed
                        ? 'border-red-500/30 bg-red-500/5'
                        : 'border-slate-800/80 bg-slate-950/20'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-200">
                          分块 #{chunk.chunk_index + 1}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          (序号: {chunk.start_index} - {chunk.end_index})
                        </span>
                      </div>
                      {isFailed && chunk.error_message && (
                        <p className="text-xs text-red-400 mt-1 leading-relaxed bg-red-950/20 p-2 rounded border border-red-900/30 font-mono">
                          ⚠️ 失败原因: {chunk.error_message}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {isCompleted && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold flex items-center gap-1">
                          ✅ 处理完成
                        </span>
                      )}
                      {isProcessing && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                          处理中...
                        </span>
                      )}
                      {isFailed && (
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold">
                            ❌ 处理失败
                          </span>
                          <button
                            onClick={resumeProcessing}
                            disabled={resuming}
                            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer shadow-sm hover:shadow-rose-600/20 disabled:opacity-50"
                          >
                            重试
                          </button>
                        </div>
                      )}
                      {chunk.status === 'pending' && (
                        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-semibold">
                          等待中
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Start/Resume Action if paused */}
            {activeTopic.status === 'pending' && !chunks.some((c) => c.status === 'processing') && (
              <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col items-center gap-3">
                <p className="text-xs text-slate-400 text-center">
                  ⚠️ 解析任务未在运行，点击下方按钮开始或继续分析。
                </p>
                <button
                  onClick={resumeProcessing}
                  disabled={resuming}
                  className="w-full max-w-sm py-3 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 transition-all cursor-pointer shadow-lg shadow-rose-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {resuming ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    '🚀 开始/继续分析字幕'
                  )}
                </button>
              </div>
            )}

            {/* Merge Action */}
            {allCompleted && (
              <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col items-center gap-3">
                <p className="text-xs text-slate-400 text-center">🎉 所有分块已经成功完成翻译与语法深度解析！</p>
                <button
                  onClick={handleMerge}
                  disabled={merging}
                  className="w-full max-w-sm py-3 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {merging ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    '✨ 合并字幕并开启完整解析'
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <SubtitleDetail
            activeTopic={activeTopic}
            activeSentIdx={activeSentIdx}
            setActiveSentIdx={setActiveSentIdx}
            onBackToList={() => {
              setActiveTopic(null)
              refreshList()
            }}
            onTopicUpdate={setActiveTopic}
            isOwner={activeTopic.user_id === user?.id}
          />
        )}
      </main>
    </div>
  )
}
