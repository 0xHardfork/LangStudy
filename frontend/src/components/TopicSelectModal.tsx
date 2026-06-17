import { useState } from 'react'
import { TOPIC_EMOJIS } from '../types'

interface Props {
  topics: string[]
  onSelect: (topic: string) => void
  onClose: () => void
}

export default function TopicSelectModal({ topics, onSelect, onClose }: Props) {
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
          width: '100%', maxWidth: '560px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.7)',
        }}
      >
        <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.25rem', marginBottom: '0.5rem' }}>
          选择对话主题
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          AI 将为你生成该主题的真实对话练习
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {topics.map((topic) => (
            <button
              key={topic}
              id={`topic-${topic}`}
              onClick={() => onSelect(topic)}
              onMouseEnter={() => setHovered(topic)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.875rem 1rem',
                borderRadius: '0.75rem',
                border: hovered === topic
                  ? '1px solid #7c3aed'
                  : '1px solid rgba(100,116,139,0.2)',
                background: hovered === topic
                  ? 'rgba(124,58,237,0.15)'
                  : 'rgba(30,41,59,0.5)',
                color: hovered === topic ? '#c4b5fd' : '#cbd5e1',
                fontSize: '0.875rem', fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left',
                transform: hovered === topic ? 'translateY(-1px)' : 'none',
                boxShadow: hovered === topic ? '0 4px 16px rgba(124,58,237,0.2)' : 'none',
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{TOPIC_EMOJIS[topic] ?? '💬'}</span>
              <span>{topic}</span>
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
