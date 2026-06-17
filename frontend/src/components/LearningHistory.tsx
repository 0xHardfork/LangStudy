import { useState, useEffect } from 'react'
import { listDialogues, getDialogue } from '../services/api'
import type { Dialogue } from '../types'
import { LANGUAGE_LABELS, LEVEL_LABELS, TOPIC_EMOJIS } from '../types'

interface Props {
  token: string
  onSelectDialogue: (dialogue: Dialogue) => void
  onBack: () => void
}

export default function LearningHistory({ token, onSelectDialogue, onBack }: Props) {
  const [dialogues, setDialogues] = useState<Dialogue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchingDetailId, setFetchingDetailId] = useState<number | null>(null)

  useEffect(() => {
    listDialogues(token)
      .then((data) => {
        const sorted = [...data].sort((a, b) => b.id - a.id)
        setDialogues(sorted)
      })
      .catch((err) => {
        setError(err.message ?? '获取学习历史失败')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token])

  const handleStartReview = async (id: number) => {
    setFetchingDetailId(id)
    setError(null)
    try {
      const fullDialogue = await getDialogue(token, id)
      onSelectDialogue(fullDialogue)
    } catch (err: unknown) {
      setError((err as Error).message ?? '获取对话详情失败，请重试')
    } finally {
      setFetchingDetailId(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif', padding: '2rem 1.5rem' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              background: 'transparent',
              border: '1px solid rgba(100,116,139,0.3)',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.875rem',
              color: '#94a3b8',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            ← 返回主页
          </button>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            学习历史记录
          </h2>
        </div>

        {error && (
          <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
            <div style={{ width: '2rem', height: '2rem', border: '3px solid rgba(100,116,139,0.3)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : dialogues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', background: 'rgba(30,41,59,0.2)', borderRadius: '1rem', border: '1px solid rgba(100,116,139,0.1)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
            <p style={{ color: '#64748b', margin: 0 }}>暂无学习历史，快去生成对话开始学习吧！</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {dialogues.map((d) => {
              const formattedDate = new Date(d.created_at).toLocaleString('zh-CN', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
              const isFetching = fetchingDetailId === d.id

              return (
                <div
                  key={d.id}
                  style={{
                    background: 'rgba(15,23,42,0.6)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(100,116,139,0.15)',
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                      {TOPIC_EMOJIS[d.topic] ?? '💬'}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#f1f5f9', margin: '0 0 0.25rem 0' }}>
                        {d.topic}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                        <span>{LANGUAGE_LABELS[d.language] ?? d.language}</span>
                        <span>•</span>
                        <span>{LEVEL_LABELS[d.level] ?? d.level}</span>
                        <span>•</span>
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartReview(d.id)}
                    disabled={fetchingDetailId !== null}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: isFetching ? 'rgba(100,116,139,0.2)' : 'linear-gradient(135deg,#3b82f6,#7c3aed)',
                      color: isFetching ? '#64748b' : 'white',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: fetchingDetailId !== null ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isFetching ? '加载中...' : '回顾练习'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
