import { useState, useEffect, useRef } from 'react'
import type { GrammarArticle } from '../../types'
import { regenerateGrammarSentence } from '../../services/api'
import { useAppStore } from '../../store/useAppStore'
import GrammarQuizCard from './GrammarQuizCard'
import Markdown from '../common/Markdown'

// ─── Local Audio Player ──────────────────────────────────────────────────────

type PlayState = 'idle' | 'playing' | 'looping'

interface SentenceAudioProps {
  audioPath: string | null
}

function SentenceAudio({ audioPath }: SentenceAudioProps) {
  const [playState, setPlayState] = useState<PlayState>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setPlayState('idle')
  }

  const play = () => {
    if (!audioPath) return
    stop()
    const a = new Audio('/' + audioPath)
    a.onended = () => setPlayState('idle')
    a.onerror = () => setPlayState('idle')
    audioRef.current = a
    setPlayState('playing')
    a.play().catch(stop)
  }

  const loop = () => {
    if (!audioPath) return
    if (playState === 'looping') {
      stop()
      return
    }
    stop()
    const a = new Audio('/' + audioPath)
    a.loop = true
    audioRef.current = a
    setPlayState('looping')
    a.play().catch(stop)
  }

  useEffect(() => {
    return () => stop()
  }, [audioPath])

  if (!audioPath) return null

  return (
    <div className="flex gap-1.5">
      <button
        onClick={play}
        disabled={playState === 'playing'}
        title="播放单次"
        className={`px-3 py-1.5 rounded-lg text-[13px] border cursor-pointer transition-all duration-150 ${
          playState === 'playing'
            ? 'bg-blue-500/25 border-blue-500/30 text-blue-400'
            : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:bg-slate-700/40 hover:text-slate-200'
        }`}
      >
        {playState === 'playing' ? '⏸ 播放中' : '🔊 听音'}
      </button>
      <button
        onClick={loop}
        title="循环播放"
        className={`px-3 py-1.5 rounded-lg text-[13px] border cursor-pointer transition-all duration-150 ${
          playState === 'looping'
            ? 'bg-violet-500/25 border-violet-500 text-violet-300'
            : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:bg-slate-700/40 hover:text-slate-200'
        }`}
      >
        {playState === 'looping' ? '⏹ 停止循环' : '🔁 循环'}
      </button>
    </div>
  )
}

// ─── GrammarArticleDetail Component ──────────────────────────────────────────

interface GrammarArticleDetailProps {
  activeArticle: GrammarArticle
  activeSentIdx: number | null
  setActiveSentIdx: (idx: number | null) => void
  onBackToList: () => void
  onArticleUpdate: (updated: GrammarArticle) => void
}

export default function GrammarArticleDetail({
  activeArticle,
  activeSentIdx,
  setActiveSentIdx,
  onBackToList,
  onArticleUpdate,
}: GrammarArticleDetailProps) {
  const token = useAppStore((state) => state.token!)

  const [regenerating, setRegenerating] = useState(false)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)

  const handleRegenerate = async (sentenceId: number) => {
    if (regenerating) return
    setRegenerating(true)
    setRegenerateError(null)
    try {
      const newSent = await regenerateGrammarSentence(token, sentenceId)
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

  const currentSentence =
    activeArticle.sentences && activeSentIdx !== null
      ? activeArticle.sentences[activeSentIdx]
      : null

  const currentQuiz = currentSentence?.quizzes?.[0] || null

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header / Navigation back */}
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

      {/* Split view: text vs analysis panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        
        {/* Left Side: Article clickable sentence blocks */}
        <div className="p-6 rounded-2xl bg-slate-900/15 border border-slate-800/60 flex flex-col gap-4">
          <div className="text-xs text-slate-500 font-semibold">
            💡 提示：点击下方的英文句子即可呼出对应的深度语法解析
          </div>

          <div className="text-lg leading-loose text-slate-300 flex flex-wrap gap-2">
            {activeArticle.sentences?.map((sent, idx) => {
              const isActive = activeSentIdx === idx
              return (
                <span
                  key={sent.id || idx}
                  onClick={() => setActiveSentIdx(idx)}
                  className={`cursor-pointer py-0.5 px-1.5 rounded transition-all duration-150 ${
                    isActive
                      ? 'bg-violet-500/20 border-b-2 border-violet-400 text-slate-100'
                      : 'border-b border-dashed border-slate-700 hover:bg-slate-800/30'
                  }`}
                >
                  {sent.original_text}
                </span>
              )
            })}
          </div>
        </div>

        {/* Right Side: Grammar analysis card & Cloze quiz */}
        <div className="flex flex-col gap-6">
          {currentSentence ? (
            <>
              {/* Grammar analysis card */}
              <div className="p-6 rounded-2xl bg-slate-900/25 border border-slate-800/80 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                  <span className="text-xs text-slate-500 font-bold">
                    句 {activeSentIdx! + 1} / {activeArticle.sentences?.length}
                  </span>
                  <SentenceAudio audioPath={currentSentence.audio_path} />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-505 font-semibold">原文</span>
                  <span className="text-[17px] text-slate-100 font-semibold leading-relaxed">
                    {currentSentence.original_text}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-505 font-semibold">中文释义</span>
                  <span className="text-sm text-slate-400 leading-relaxed">
                    {currentSentence.translation}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-505 font-semibold">语法讲解</span>
                    <button
                      disabled={regenerating}
                      onClick={() => handleRegenerate(currentSentence.id)}
                      className="px-2.5 py-1 rounded bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs cursor-pointer hover:bg-violet-500/20 disabled:bg-violet-500/5 disabled:cursor-not-allowed transition-all"
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

              {/* Cloze multiple choice card */}
              {currentQuiz && (
                <GrammarQuizCard
                  quiz={currentQuiz}
                />
              )}
            </>
          ) : (
            <div className="text-slate-500 text-sm text-center py-12">
              请在左侧选择句子查看详情
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
