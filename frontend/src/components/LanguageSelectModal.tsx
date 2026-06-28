import type { TargetLanguage } from '../types'
import { LANGUAGE_LABELS, LANGUAGE_FLAGS, LEVEL_LABELS } from '../types'

interface Props {
  languages: TargetLanguage[]
  onSelect: (lang: TargetLanguage) => void
  onClose: () => void
}

export default function LanguageSelectModal({ languages, onSelect, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900/95 border border-slate-850 rounded-2xl p-6 md:p-8 w-full max-w-sm shadow-2xl"
      >
        <h2 className="text-slate-100 font-bold text-xl mb-2">
          选择学习语言
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          检测到你有多个目标语言，请选择本次练习语言
        </p>

        <div className="flex flex-col gap-2.5">
          {languages.map((tl) => (
            <button
              key={tl.lang}
              id={`lang-select-${tl.lang}`}
              onClick={() => onSelect(tl)}
              className="group flex items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/40 text-slate-200 cursor-pointer transition-all duration-150 text-left hover:border-violet-500 hover:bg-violet-500/10 hover:text-violet-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-500/10"
            >
              <span className="text-2xl">{LANGUAGE_FLAGS[tl.lang] ?? '🌐'}</span>
              <div>
                <div className="font-semibold text-sm">
                  {LANGUAGE_LABELS[tl.lang] ?? tl.lang}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 transition-colors duration-150 group-hover:text-violet-400/80">
                  {LEVEL_LABELS[tl.level] ?? tl.level}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-lg border border-slate-800 bg-transparent text-slate-500 text-sm cursor-pointer hover:bg-slate-800/40 hover:text-slate-350 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  )
}
