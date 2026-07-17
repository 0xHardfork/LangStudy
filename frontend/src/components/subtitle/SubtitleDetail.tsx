import { useState } from 'react'
import type { SubtitleTopic } from '../../types'
import { regenerateSubtitleSentence, shareSubtitleTopic, unshareSubtitleTopic } from '../../services/api'
import { useAppStore } from '../../store/useAppStore'
import Markdown from '../common/Markdown'

interface Props {
  activeTopic: SubtitleTopic
  activeSentIdx: number | null
  setActiveSentIdx: (idx: number) => void
  onBackToList: () => void
  onTopicUpdate: (topic: SubtitleTopic) => void
  isOwner: boolean
}

export default function SubtitleDetail({
  activeTopic,
  activeSentIdx,
  setActiveSentIdx,
  onBackToList,
  onTopicUpdate,
  isOwner,
}: Props) {
  const token = useAppStore((state) => state.token!)
  const [regenerating, setRegenerating] = useState(false)
  const [sharingToggle, setSharingToggle] = useState(false)

  const sentences = activeTopic.sentences ?? []
  const currentSentence = activeSentIdx !== null ? sentences[activeSentIdx] : null

  const handleRegenerate = async () => {
    if (!isOwner || !currentSentence || regenerating) return
    if (!confirm('确定要重新生成这句的语法分析吗？')) return

    setRegenerating(true)
    try {
      const updated = await regenerateSubtitleSentence(token, currentSentence.id)
      const updatedSentences = sentences.map((s) => (s.id === updated.id ? updated : s))
      onTopicUpdate({
        ...activeTopic,
        sentences: updatedSentences,
      })
    } catch (err: any) {
      alert('重新生成失败: ' + err.message)
    } finally {
      setRegenerating(false)
    }
  }

  const handleToggleShare = async () => {
    if (!isOwner || sharingToggle) return
    setSharingToggle(true)
    try {
      if (activeTopic.is_shared) {
        await unshareSubtitleTopic(token, activeTopic.id)
        onTopicUpdate({ ...activeTopic, is_shared: false })
      } else {
        await shareSubtitleTopic(token, activeTopic.id)
        onTopicUpdate({ ...activeTopic, is_shared: true })
      }
    } catch (err: any) {
      alert('操作失败: ' + err.message)
    } finally {
      setSharingToggle(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 select-none">
      {/* Detail Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToList}
            className="p-2 border border-slate-800 bg-slate-950/30 hover:bg-slate-900 text-slate-300 rounded-lg cursor-pointer text-sm font-semibold transition-colors"
          >
            ← 返回列表
          </button>
          
          {isOwner && (
            <button
              onClick={handleToggleShare}
              disabled={sharingToggle}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                activeTopic.is_shared
                  ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/40'
                  : 'border-slate-800 bg-slate-950/30 text-slate-400 hover:text-slate-200'
              }`}
            >
              {sharingToggle ? '处理中...' : activeTopic.is_shared ? '🔓 取消共享' : '🔗 分享至字幕库'}
            </button>
          )}

          <div className="min-w-0">
            <h1 className="m-0 text-xl font-extrabold text-slate-100 truncate">{activeTopic.title}</h1>
            <p className="m-0 mt-0.5 text-xs text-slate-500 truncate">原文件名: {activeTopic.original_file_name}</p>
          </div>
        </div>

        {/* Download file endpoints */}
        <div className="flex items-center gap-2">
          <a
            href={`/api/v1/subtitle/topic/${activeTopic.id}/download/learning`}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-300 text-xs font-semibold hover:border-rose-500/40 hover:text-white transition-all text-center flex items-center gap-1.5"
          >
            📥 下载所学语言字幕 (.srt)
          </a>
          <a
            href={`/api/v1/subtitle/topic/${activeTopic.id}/download/bilingual`}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-300 text-xs font-semibold hover:border-amber-500/40 hover:text-white transition-all text-center flex items-center gap-1.5"
          >
            📥 下载双语字幕 (.srt)
          </a>
        </div>
      </div>

      {/* Main split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Sentences scrolling list */}
        <div className="lg:col-span-5 border border-slate-800/80 rounded-2xl bg-slate-900/25 p-5 flex flex-col gap-4 max-h-[70vh]">
          <h3 className="m-0 text-sm font-bold text-slate-400">📖 逐句解析列表 (共 {sentences.length} 句)</h3>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
            {sentences.length === 0 ? (
              <div className="text-slate-500 text-sm text-center py-10">未提取到逻辑句子</div>
            ) : (
              sentences.map((sent, index) => {
                const isActive = activeSentIdx === index
                return (
                  <div
                    key={sent.id}
                    onClick={() => setActiveSentIdx(index)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      isActive
                        ? 'bg-rose-950/20 border-rose-500/60 shadow-lg shadow-rose-500/5'
                        : 'bg-slate-950/40 border-slate-900 hover:border-slate-800 hover:bg-slate-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                        #{index + 1}
                      </span>
                    </div>
                    <p className="m-0 text-slate-200 text-[14px] leading-relaxed select-text font-serif">
                      {sent.original_text}
                    </p>
                    {sent.translation && (
                      <p className="m-0 mt-2 text-slate-500 text-xs leading-normal select-text">
                        {sent.translation}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Side: Grammar analysis details */}
        <div className="lg:col-span-7 border border-slate-800/80 rounded-2xl bg-slate-900/25 p-5 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
          {currentSentence ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <span className="text-sm font-bold text-slate-400">💡 深度语法分析</span>
                {isOwner && (
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="px-3 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {regenerating ? '重新生成中...' : '🔄 重新分析'}
                  </button>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-900 select-text">
                <h4 className="m-0 text-xs text-slate-500 mb-1">当前句子 (Original Sentence)</h4>
                <p className="m-0 text-slate-100 text-base font-serif leading-relaxed">{currentSentence.original_text}</p>
                <h4 className="m-0 text-xs text-slate-500 mt-4 mb-1">翻译 (Translation)</h4>
                <p className="m-0 text-rose-300 text-sm leading-relaxed">{currentSentence.translation}</p>
              </div>

              {/* Grammar breakdown markdown */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-900/80">
                <h4 className="m-0 text-xs text-slate-500 mb-3">语法解析 (Detailed Grammar Breakdown)</h4>
                <div className="select-text prose prose-invert max-w-none text-slate-350 text-sm">
                  {currentSentence.explanation ? (
                    <Markdown text={currentSentence.explanation} />
                  ) : (
                    <p className="m-0 text-slate-500 italic">暂无详细解析数据</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-500 text-sm">👈 请在左侧选择需要查看的句子</div>
          )}
        </div>
      </div>
    </div>
  )
}
