import type { DialogueType } from '../types'

interface Props {
  types: DialogueType[]
  onSelect: (type: DialogueType) => void
  onClose: () => void
}

export default function TopicSelectModal({ types, onSelect, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900/95 border border-slate-850 rounded-2xl p-6 md:p-8 w-full max-w-2xl shadow-2xl max-h-[80vh] overflow-y-auto"
      >
        <h2 className="text-slate-100 font-bold text-xl mb-2">
          选择对话主题
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          AI 将为你生成该主题的真实对话练习
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {types.map((type) => (
            <button
              key={type.id}
              id={`topic-${type.id}`}
              onClick={() => onSelect(type)}
              className="group flex items-start gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 text-slate-300 text-sm font-medium cursor-pointer transition-all duration-150 text-left hover:border-violet-500 hover:bg-violet-500/10 hover:text-violet-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-500/10"
            >
              <span className="text-xl shrink-0">{type.emoji}</span>
              <div className="min-w-0">
                <div className="font-semibold mb-1">{type.name}</div>
                {type.description && (
                  <div className="text-xs text-slate-500 leading-normal line-clamp-2 transition-colors duration-150 group-hover:text-violet-400/80">
                    {type.description}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-2.5 rounded-lg border border-slate-800 bg-transparent text-slate-500 text-sm cursor-pointer hover:bg-slate-800/40 hover:text-slate-350 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  )
}
