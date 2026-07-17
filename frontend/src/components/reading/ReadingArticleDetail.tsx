import { useState } from 'react'
import type { ReadingArticle, ReadingSentence } from '../../types'
import { regenerateReadingSentence, addReadingSentence } from '../../services/api'
import { useAppStore } from '../../store/useAppStore'
import Markdown from '../common/Markdown'
import SentenceAudio from './SentenceAudio'

// ─── ReadingArticleDetail Component ──────────────────────────────────────────

interface ReadingArticleDetailProps {
  activeArticle: ReadingArticle
  activeSentIdx: number | null
  setActiveSentIdx: (idx: number | null) => void
  onBackToList: () => void
  onArticleUpdate: (updated: ReadingArticle) => void
}

export default function ReadingArticleDetail({
  activeArticle,
  activeSentIdx,
  setActiveSentIdx,
  onBackToList,
  onArticleUpdate,
}: ReadingArticleDetailProps) {
  const token = useAppStore((state) => state.token!)
  const [regenerating, setRegenerating] = useState(false)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)
  const [newSentenceText, setNewSentenceText] = useState('')
  const [addingSentence, setAddingSentence] = useState(false)
  const [addSentenceError, setAddSentenceError] = useState<string | null>(null)

  const handleRegenerate = async (sentenceId: number) => {
    if (regenerating) return
    setRegenerating(true)
    setRegenerateError(null)
    try {
      const newSent = await regenerateReadingSentence(token, sentenceId)
      const updatedSents = activeArticle.sentences?.map((s) =>
        s.id === sentenceId ? { ...s, ...newSent } : s
      )
      onArticleUpdate({
        ...activeArticle,
        sentences: updatedSents,
      })
    } catch (err: any) {
      setRegenerateError(err.message || '重新生成失败，请重试')
    } finally {
      setRegenerating(false)
    }
  }

  const handleAddSentence = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSentenceText.trim() || addingSentence) return
    setAddingSentence(true)
    setAddSentenceError(null)
    try {
      const updatedArticle = await addReadingSentence(token, activeArticle.id, newSentenceText)
      onArticleUpdate(updatedArticle)
      setNewSentenceText('')
      
      const oldLength = activeArticle.sentences?.length ?? 0
      const newLength = updatedArticle.sentences?.length ?? 0
      if (newLength > oldLength) {
        const addedSent = updatedArticle.sentences?.find((s) => s.sentence_index === oldLength)
        if (addedSent) {
          setActiveSentIdx(addedSent.sentence_index)
        } else {
          setActiveSentIdx(oldLength)
        }
      }
    } catch (err: any) {
      setAddSentenceError(err.message || '添加新句子失败，请重试')
    } finally {
      setAddingSentence(false)
    }
  }

  const currentSentence =
    activeArticle.sentences && activeSentIdx !== null
      ? activeArticle.sentences[activeSentIdx]
      : null

  // Group sentences by paragraph
  const paragraphs: ReadingSentence[][] = []
  activeArticle.sentences?.forEach((sent) => {
    const pIdx = sent.paragraph_index
    if (!paragraphs[pIdx]) {
      paragraphs[pIdx] = []
    }
    paragraphs[pIdx].push(sent)
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBackToList}
          className="px-3 py-1.5 rounded-lg border border-slate-700 bg-transparent text-slate-400 text-xs cursor-pointer hover:bg-slate-800 hover:text-slate-200 transition-colors"
        >
          ← 返回列表
        </button>
        <h2 className="m-0 text-xl font-extrabold text-slate-100">
          📖 {activeArticle.title}
        </h2>
      </div>

      {/* Split view */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left Side: Dialogue Chat Bubble view */}
        <div className="p-6 rounded-2xl bg-slate-900/15 border border-slate-800/60 flex flex-col gap-4 max-h-[70vh]">
          <div className="text-xs text-slate-500 font-semibold">
            💡 提示：点击下方的英文句子即可显示对应句子的中文释义与详细语法解析
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-6 pr-1">
            {paragraphs.length === 0 ? (
              <div className="text-slate-500 text-sm text-center py-12">
                💡 主题下暂无句子，请在下方输入并解析第一句！
              </div>
            ) : (
              paragraphs.map((sentencesInP, pIdx) => (
                <div
                  key={pIdx}
                  className="p-4 rounded-xl bg-slate-950/20 border border-slate-900 flex flex-col gap-3"
                >
                  <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                    段落 {pIdx + 1}
                  </div>
                  <div className="text-base leading-relaxed text-slate-350 flex flex-wrap gap-x-2 gap-y-1.5">
                    {sentencesInP.map((sent) => {
                      const isActive = activeSentIdx === sent.sentence_index
                      return (
                        <span
                          key={sent.id}
                          onClick={() => setActiveSentIdx(sent.sentence_index)}
                          className={`cursor-pointer px-1 rounded transition-all duration-150 ${
                            isActive
                              ? 'bg-blue-500/25 border-b-2 border-blue-400 text-slate-100 shadow-sm'
                              : 'border-b border-dashed border-slate-700/60 hover:bg-slate-800/40 text-slate-300'
                          }`}
                        >
                          {sent.original_text}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add sentence form */}
          <div className="mt-2 pt-4 border-t border-slate-800/80">
            <form onSubmit={handleAddSentence} className="flex flex-col gap-3">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                ➕ 在此主题下追加新句子并解析
              </span>
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  value={newSentenceText}
                  onChange={(e) => setNewSentenceText(e.target.value)}
                  placeholder="输入新的英文句子，支持多句或段落..."
                  className="flex-1 p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-100 text-xs outline-none focus:border-blue-500/50 transition-colors resize-none leading-relaxed"
                />
                <button
                  type="submit"
                  disabled={addingSentence || !newSentenceText.trim()}
                  className="px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center justify-center disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer"
                >
                  {addingSentence ? '解析中...' : '发送'}
                </button>
              </div>
              {addSentenceError && (
                <div className="text-red-400 text-[11px] font-semibold">
                  ⚠️ {addSentenceError}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right Side: Grammar analysis card */}
        <div className="flex flex-col gap-6">
          {currentSentence ? (
            <div className="p-6 rounded-2xl bg-slate-900/25 border border-slate-800/80 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                <span className="text-xs text-slate-500 font-bold">
                  句 {activeSentIdx! + 1} / {activeArticle.sentences?.length}
                </span>
                <SentenceAudio audioPath={currentSentence.audio_path} />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500 font-semibold">英文原文</span>
                <span className="text-lg text-slate-100 font-semibold leading-relaxed">
                  {currentSentence.original_text}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500 font-semibold">中文释义</span>
                <span className="text-sm text-slate-300 leading-relaxed bg-slate-950/20 p-2.5 rounded border border-slate-900/30">
                  {currentSentence.translation}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-500 font-semibold">深度语法解析</span>
                  <button
                    disabled={regenerating}
                    onClick={() => handleRegenerate(currentSentence.id)}
                    className="px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs cursor-pointer hover:bg-blue-500/20 disabled:bg-blue-500/5 disabled:cursor-not-allowed transition-all"
                  >
                    {regenerating ? '🔄 正在重新生成...' : '🔄 重新生成 AI 解析'}
                  </button>
                </div>
                {regenerateError && (
                  <div className="text-xs text-red-400 mt-1">
                    ⚠️ {regenerateError}
                  </div>
                )}
                <div className="text-sm text-slate-300 leading-relaxed bg-slate-950/30 p-3 rounded-lg border border-slate-900">
                  <Markdown text={currentSentence.explanation} />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-slate-900/10 border border-slate-800/40 text-slate-500 text-sm text-center py-16">
              💡 请在左侧选择句子查看详细的中文翻译和深度语法解析
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
