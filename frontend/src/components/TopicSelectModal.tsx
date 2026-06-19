import { useState } from 'react'
import type { DialogueType } from '../types'

interface Props {
  types: DialogueType[]
  onSelect: (type: DialogueType) => void
  onClose: () => void
}

export default function TopicSelectModal({ types, onSelect, onClose }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)

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
          width: '100%', maxWidth: '600px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.7)',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.25rem', marginBottom: '0.5rem' }}>
          选择对话主题
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          AI 将为你生成该主题的真实对话练习
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {types.map((type) => (
            <button
              key={type.id}
              id={`topic-${type.id}`}
              onClick={() => onSelect(type)}
              onMouseEnter={() => setHovered(type.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                padding: '0.875rem 1rem',
                borderRadius: '0.75rem',
                border: hovered === type.id
                  ? '1px solid #7c3aed'
                  : '1px solid rgba(100,116,139,0.2)',
                background: hovered === type.id
                  ? 'rgba(124,58,237,0.15)'
                  : 'rgba(30,41,59,0.5)',
                color: hovered === type.id ? '#c4b5fd' : '#cbd5e1',
                fontSize: '0.875rem', fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left',
                transform: hovered === type.id ? 'translateY(-1px)' : 'none',
                boxShadow: hovered === type.id ? '0 4px 16px rgba(124,58,237,0.2)' : 'none',
              }}
            >
              <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{type.emoji}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{type.name}</div>
                {type.description && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: hovered === type.id ? '#a78bfa' : '#64748b',
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as const,
                  }}>
                    {type.description}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: '1.5rem', width: '100%',
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
