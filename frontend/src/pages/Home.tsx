import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import TopicSelectModal from '../components/TopicSelectModal'
import LanguageSelectModal from '../components/LanguageSelectModal'
import { getActiveDialogue, getSharedDialogue, generateDialogue } from '../services/api'
import { LEVEL_LABELS, LANGUAGE_LABELS } from '../types'
import type { DialogueType, TargetLanguage } from '../types'

export default function Home() {
  const navigate = useNavigate()
  const token = useAppStore((state) => state.token!)
  const learningProfile = useAppStore((state) => state.learningProfile)
  const dialogueTypes = useAppStore((state) => state.dialogueTypes)
  const exerciseResult = useAppStore((state) => state.exerciseResult)
  const generatingError = useAppStore((state) => state.generatingError)

  const {
    setCurrentDialogue,
    setPreviewLineIndex,
    setGeneratingError,
    setExerciseResult,
    setSelectedTopic,
    setSelectedLanguage,
  } = useAppStore()

  // Local modal states
  const [showTopicSelect, setShowTopicSelect] = useState(false)
  const [showLanguageSelect, setShowLanguageSelect] = useState(false)
  const [generating, setGenerating] = useState(false)

  const handleStartLearning = async () => {
    setExerciseResult(null)
    try {
      const active = await getActiveDialogue(token)
      if (active) {
        setCurrentDialogue(active.dialogue)
        setPreviewLineIndex(active.current_line_index)
        navigate('/preview')
        return
      }
    } catch {
      // No active dialogue — fall through to topic selection
    }
    setShowTopicSelect(true)
  }

  const handleTopicSelect = (type: DialogueType) => {
    setSelectedTopic(type.name)
    setShowTopicSelect(false)
    const targets = learningProfile?.target_languages ?? []
    if (targets.length === 0) {
      alert('请先在个人设定中配置学习语言与等级')
    } else if (targets.length === 1 && targets[0]) {
      setSelectedLanguage(targets[0])
      beginGenerate(type.name, targets[0])
    } else {
      setShowLanguageSelect(true)
    }
  }

  const handleLanguageSelect = (lang: TargetLanguage) => {
    setSelectedLanguage(lang)
    setShowLanguageSelect(false)
    const selectedTopic = useAppStore.getState().selectedTopic
    beginGenerate(selectedTopic, lang)
  }

  const beginGenerate = async (topic: string, lang: TargetLanguage) => {
    try {
      const shared = await getSharedDialogue(token, topic, lang.lang, lang.level)
      setCurrentDialogue(shared.dialogue)
      setPreviewLineIndex(shared.current_line_index)
      navigate('/preview')
      return
    } catch {
      // No shared dialogue — generate a new one
    }

    setGenerating(true)
    setGeneratingError(null)
    try {
      const d = await generateDialogue(token, { topic, language: lang.lang, level: lang.level })
      setCurrentDialogue(d)
      setPreviewLineIndex(0)
      navigate('/preview')
    } catch (e: unknown) {
      setGeneratingError((e as Error).message ?? '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const activeTargetLang = learningProfile?.target_languages?.[0]

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center mb-12 animate-fadeIn">
        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400 bg-clip-text text-transparent mb-3">
          AI 对话语言学习
        </h1>
        <p className="text-slate-450 text-sm">
          通过 AI 生成的真实对话练习，掌握地道表达
        </p>
      </div>

      {exerciseResult && (
        <div className="mb-6 p-4 rounded-xl border border-green-500/20 bg-green-500/5 animate-fadeIn">
          <p className="m-0 font-semibold text-green-300 text-sm">
            {exerciseResult.wrongCount === 0 ? '🎉 全部正确！' : `📝 本次错误 ${exerciseResult.wrongCount} 句，已加入复习队列`}
          </p>
        </div>
      )}

      {generatingError && (
        <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
          <p className="m-0 text-red-300 font-semibold text-sm">⚠️ 生成失败：{generatingError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 mb-10">
        <ActionCard
          id="btn-start-learning"
          emoji="🎓"
          title="今日学习"
          desc="AI 生成新对话，开始填空练习"
          cardClass="bg-gradient-to-br from-blue-950/70 to-indigo-950/50 hover:from-blue-900/90 hover:to-indigo-900/70 hover:shadow-blue-500/10"
          onClick={handleStartLearning}
        />
        <ActionCard
          id="btn-start-review"
          emoji="🔄"
          title="今日复习"
          desc="复习已学错题，巩固记忆"
          cardClass="bg-gradient-to-br from-emerald-950/40 to-teal-950/30 hover:from-emerald-900/50 hover:to-teal-900/40 hover:shadow-emerald-500/5"
          onClick={() => navigate('/review')}
        />
        <ActionCard
          id="btn-start-grammar"
          emoji="📖"
          title="文章语法分析"
          desc="分析英语段落，学习语法并进行完形填空测试"
          cardClass="bg-gradient-to-br from-fuchsia-950/40 to-purple-950/30 hover:from-fuchsia-900/50 hover:to-purple-900/40 hover:shadow-purple-500/5"
          onClick={() => navigate('/grammar')}
        />
        <ActionCard
          id="btn-start-history"
          emoji="📚"
          title="浏览学习历史"
          desc="浏览并回顾已经学过的对话"
          cardClass="bg-gradient-to-br from-violet-950/30 to-slate-900/40 hover:from-violet-900/40 hover:to-slate-900/50 hover:shadow-violet-500/5"
          onClick={() => navigate('/history')}
        />
      </div>

      {activeTargetLang && (
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/20 text-center">
          <span className="text-slate-400 text-xs">
            当前配置：母语 <strong>{learningProfile?.native_language === 'zh' ? '中文' : learningProfile?.native_language.toUpperCase()}</strong> | 
            目标语言 <strong>{LANGUAGE_LABELS[activeTargetLang.lang] ?? activeTargetLang.lang} ({LEVEL_LABELS[activeTargetLang.level]})</strong>
          </span>
        </div>
      )}

      {showTopicSelect && (
        <TopicSelectModal
          types={dialogueTypes}
          onSelect={handleTopicSelect}
          onClose={() => setShowTopicSelect(false)}
        />
      )}

      {showLanguageSelect && (
        <LanguageSelectModal
          languages={learningProfile?.target_languages ?? []}
          onSelect={handleLanguageSelect}
          onClose={() => setShowLanguageSelect(false)}
        />
      )}

      {generating && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center gap-6">
          <div className="w-12 h-12 border-3 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-violet-300 font-bold text-lg m-0">AI 正在生成对话...</p>
            <p className="text-slate-500 text-sm mt-2 m-0">同时生成语音，请稍候（约 30-60 秒）</p>
          </div>
        </div>
      )}
    </main>
  )
}

function ActionCard({
  id, emoji, title, desc, cardClass, onClick,
}: {
  id: string; emoji: string; title: string; desc: string
  cardClass: string; onClick: () => void
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`p-6 rounded-2xl border border-slate-800/80 text-left cursor-pointer flex items-center gap-5 w-full transition-all duration-300 hover:translate-y-[-4px] hover:shadow-xl ${cardClass}`}
    >
      <div className="text-4xl shrink-0">{emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-lg text-slate-100 mb-1">{title}</div>
        <div className="text-xs text-slate-400 leading-normal">{desc}</div>
      </div>
    </button>
  )
}
