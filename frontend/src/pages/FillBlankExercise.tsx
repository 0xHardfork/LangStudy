import { useState } from 'react'
import type { Dialogue, DialogueLine } from '../types'
import { submitAnswer, updateDialogueProgress } from '../services/api'
import { useAppStore } from '../store/useAppStore'
import DialogueLineItem from '../components/dialogue/DialogueLineItem'
import FillBlankCard from '../components/dialogue/FillBlankCard'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.includes(' ') ? text.split(' ') : text.split('')
}

function splitToken(token: string): { prefix: string; clean: string; suffix: string } {
  const isPunctuation = (char: string | undefined) => {
    if (!char) return false
    return /^[^\p{L}\p{N}]+$/u.test(char)
  }

  let start = 0
  while (start < token.length && isPunctuation(token[start])) {
    start++
  }

  let end = token.length
  while (end > start && isPunctuation(token[end - 1])) {
    end--
  }

  return {
    prefix: token.slice(0, start),
    clean: token.slice(start, end),
    suffix: token.slice(end),
  }
}

function getBlankIndices(line: DialogueLine, level: number): Set<number> {
  if (level === 4) return new Set()
  const sorted = [...line.vocabulary].sort((a, b) => a.importance - b.importance)
  const sliced = sorted.slice(0, level)
  return new Set(sliced.map((v) => v.word_index))
}

// ─── FillBlankExercise Component ─────────────────────────────────────────────

interface Props {
  dialogue: Dialogue
  fillBlankLevel: number
  initialLineIndex?: number
  onFinish: (wrongCount: number) => void
  onLevelChange: (level: number) => void
  onBack: () => void
}

export default function FillBlankExercise({
  dialogue,
  fillBlankLevel,
  initialLineIndex = 0,
  onFinish,
  onLevelChange,
  onBack,
}: Props) {
  const token = useAppStore((state) => state.token!)
  const [currentIndex, setCurrentIndex] = useState(initialLineIndex)
  const [inputs, setInputs] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [wrongCount, setWrongCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [showFullTextModal, setShowFullTextModal] = useState(false)

  const line = dialogue.lines[currentIndex]

  if (!line) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        无可用对话行数据
      </div>
    )
  }

  const handleInput = (idx: number, val: string) => {
    setInputs((prev) => ({ ...prev, [idx]: val }))
  }

  const checkAnswer = (): boolean => {
    const normalize = (s: string) => {
      return s
        .trim()
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    }
    const tokens = tokenize(line.original_text)
    const blankIndices = fillBlankLevel === 4
      ? new Set(
          tokens
            .map((tok, idx) => {
              const { clean } = splitToken(tok)
              return clean.length > 0 ? idx : -1
            })
            .filter((idx) => idx !== -1)
        )
      : getBlankIndices(line, fillBlankLevel)

    for (const idx of blankIndices) {
      const given = normalize(inputs[idx] ?? '')
      const tok = tokens[idx] ?? ''
      const { clean } = splitToken(tok)
      const expected = normalize(clean)
      if (given !== expected) return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (submitting) return
    const correct = checkAnswer()
    setIsCorrect(correct)
    setSubmitted(true)
    if (!correct) setWrongCount((w) => w + 1)

    setSubmitting(true)
    try {
      await submitAnswer(token, {
        dialogue_line_id: line.id,
        is_correct: correct,
      })
    } catch (e) {
      console.warn('submitAnswer failed', e)
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = () => {
    const nextIdx = currentIndex + 1
    if (nextIdx >= dialogue.lines.length) {
      // Mark as completed
      updateDialogueProgress(token, dialogue.id, nextIdx, true).catch(console.warn)
      onFinish(wrongCount)
      return
    }
    // Save progress (fire-and-forget)
    updateDialogueProgress(token, dialogue.id, nextIdx, false).catch(console.warn)
    setCurrentIndex(nextIdx)
    setInputs({})
    setSubmitted(false)
    setIsCorrect(false)
    setShowTranslation(false)
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1
      updateDialogueProgress(token, dialogue.id, prevIdx, false).catch(console.warn)
      setCurrentIndex(prevIdx)
      setInputs({})
      setSubmitted(false)
      setIsCorrect(false)
      setShowTranslation(false)
    }
  }

  const progress = ((currentIndex + 1) / dialogue.lines.length) * 100

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between">
        <div>
          <span className="text-slate-400 text-sm">
            {dialogue.topic} · {dialogue.language.toUpperCase()}
          </span>
          <div className="mt-2 h-1 w-[200px] bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-slate-500 text-xs mt-1 block">
            {currentIndex + 1} / {dialogue.lines.length}
          </span>
        </div>

        {/* Level selector */}
        <div className="flex gap-2 items-center">
          <button
            id="btn-go-home"
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 bg-slate-800/40 text-slate-400 cursor-pointer hover:bg-slate-750 hover:text-slate-200 transition-all duration-150 mr-2"
          >
            🏠 回到首页
          </button>
          <button
            id="btn-show-full-text"
            onClick={() => setShowFullTextModal(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-500/30 bg-blue-500/10 text-blue-400 cursor-pointer hover:bg-blue-500/20 hover:text-blue-200 transition-all duration-150 mr-2"
          >
            📄 显示全文
          </button>
          {[1, 2, 3, 4].map((lvl) => (
            <button
              key={lvl}
              id={`level-btn-${lvl}`}
              onClick={() => onLevelChange(lvl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all duration-150 ${
                fillBlankLevel === lvl
                  ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                  : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-500 hover:text-slate-250'
              }`}
            >
              L{lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center p-8">
        <FillBlankCard
          line={line}
          currentIndex={currentIndex}
          fillBlankLevel={fillBlankLevel}
          inputs={inputs}
          submitted={submitted}
          isCorrect={isCorrect}
          submitting={submitting}
          wrongCount={wrongCount}
          showTranslation={showTranslation}
          setShowTranslation={setShowTranslation}
          onInput={handleInput}
          onSubmit={handleSubmit}
          onNext={handleNext}
          onPrev={handlePrev}
          hasPrev={currentIndex > 0}
          hasNext={currentIndex + 1 < dialogue.lines.length}
        />
      </div>

      {showFullTextModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-slate-900/95 border border-slate-800/80 shadow-2xl rounded-2xl p-6 md:p-8 max-w-2xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-6 border-b border-slate-800/60 pb-3">
              <h3 className="m-0 text-xl font-bold text-slate-100">
                {dialogue.topic} - 对话全文
              </h3>
              <button
                id="btn-close-full-text"
                onClick={() => setShowFullTextModal(false)}
                className="bg-transparent border-0 text-slate-400 text-2xl cursor-pointer p-1 flex items-center justify-center transition-colors hover:text-slate-100"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              {dialogue.lines.map((ln, idx) => (
                <DialogueLineItem key={ln.id} ln={ln} idx={idx} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
