import { useState } from 'react'
import type { TargetLanguage } from '../types'
import { LANGUAGE_LABELS, LANGUAGE_FLAGS, LEVEL_LABELS } from '../types'

interface Props {
  languages: TargetLanguage[]
  onSelect: (lang: TargetLanguage) => void
  onClose: () => void
}

export default function LanguageSelectModal({ languages, onSelect, onClose }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(15,23,42,0.95)',
          border: '1px solid rgba(100,116,139,0.3)',
          borderRadius: '1.25rem',
          padding: '2rem',
          width: '100%', maxWidth: '400px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.7)',
        }}
      >
        <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.25rem', marginBottom: '0.5rem' }}>
          选择学习语言
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          检测到你有多个目标语言，请选择本次练习语言
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {languages.map((tl) => (
            <button
              key={tl.lang}
              id={`lang-select-${tl.lang}`}
              onClick={() => onSelect(tl)}
              onMouseEnter={() => setHovered(tl.lang)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem 1.25rem',
                borderRadius: '0.75rem',
                border: hovered === tl.lang
                  ? '1px solid #7c3aed'
                  : '1px solid rgba(100,116,139,0.2)',
                background: hovered === tl.lang
                  ? 'rgba(124,58,237,0.15)'
                  : 'rgba(30,41,59,0.5)',
                color: hovered === tl.lang ? '#c4b5fd' : '#e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '1.75rem' }}>{LANGUAGE_FLAGS[tl.lang] ?? '🌐'}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                  {LANGUAGE_LABELS[tl.lang] ?? tl.lang}
                </div>
                <div style={{ fontSize: '0.75rem', color: hovered === tl.lang ? '#a78bfa' : '#64748b', marginTop: '0.125rem' }}>
                  {LEVEL_LABELS[tl.level] ?? tl.level}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: '1.25rem', width: '100%',
            padding: '0.625rem',
            borderRadius: '0.625rem',
            border: '1px solid rgba(100,116,139,0.2)',
            background: 'transparent',
            color: '#64748b', fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          取消
        </button>
      </div>
    </div>
  )
}
