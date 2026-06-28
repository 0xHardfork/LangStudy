import { useState } from 'react'
import type { DialogueLine } from '../../types'
import { AudioControls } from '../common/AudioPlayer'

interface DialogueLineItemProps {
  ln: DialogueLine
  idx: number
}

export default function DialogueLineItem({ ln, idx }: DialogueLineItemProps) {
  const [showTrans, setShowTrans] = useState(false)

  return (
    <div
      className={`flex flex-col gap-2 p-4 rounded-xl mb-4 border ${
        ln.speaker === 'A'
          ? 'bg-blue-950/30 border-blue-500/15'
          : 'bg-violet-950/30 border-violet-500/15'
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-bold ${
            ln.speaker === 'A' ? 'text-blue-400' : 'text-violet-400'
          }`}
        >
          {ln.speaker === 'A' ? '👩 Speaker A' : '👨 Speaker B'}
        </span>
        <AudioControls audioPath={ln.audio_path} lineIdx={idx + 1000} />
      </div>
      <p className="m-0 text-[15px] text-slate-100 leading-relaxed">
        {ln.original_text}
      </p>
      {showTrans ? (
        <div>
          <p className="m-0 mb-1 text-xs text-slate-400 italic">
            {ln.translation}
          </p>
          <button
            onClick={() => setShowTrans(false)}
            className="bg-transparent border-0 text-slate-500 text-xs cursor-pointer p-0 underline hover:text-slate-400 transition-colors"
          >
            隐藏译文
          </button>
        </div>
      ) : (
        <div>
          <button
            onClick={() => setShowTrans(true)}
            className="bg-slate-800/30 border border-slate-700/50 text-slate-450 text-xs cursor-pointer px-2 py-1 rounded font-semibold hover:bg-slate-700/40 hover:text-slate-200 transition-colors"
          >
            👁️ 显示释义
          </button>
        </div>
      )}
    </div>
  )
}
