import { useState, useEffect, useRef } from 'react'
import Login from './pages/Login'
import AdminDashboard from './components/AdminDashboard'
import TopicSelectModal from './components/TopicSelectModal'
import LanguageSelectModal from './components/LanguageSelectModal'
import FillBlankExercise from './components/FillBlankExercise'
import ReviewExercise from './components/ReviewExercise'
import UserProfileModal from './components/UserProfileModal'
import LearningHistory from './components/LearningHistory'
import DialoguePreview from './components/DialoguePreview'
import GrammarDashboard from './components/GrammarDashboard'
import { getLearningProfile, generateDialogue, getDialogueTypes, getSharedDialogue, getActiveDialogue, updateDialogueProgress } from './services/api'
import { useAppStore } from './store/useAppStore'
import { LEVEL_LABELS } from './types'
import type { TargetLanguage, UserLearningProfile, DialogueType } from './types'

interface AuthUser {
  id: number
  username: string
  role: string
  created_at: string
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const {
    currentView, setView,
    selectedTopic, setSelectedTopic,
    setSelectedLanguage,
    currentDialogue, setCurrentDialogue,
    previewLineIndex, setPreviewLineIndex,
    fillBlankLevel, setFillBlankLevel,
    generatingError, setGeneratingError,
    exerciseResult, setExerciseResult,
  } = useAppStore()

  useEffect(() => {
    if (!token) { setUser(null); return }
    setLoading(true)
    fetch('/api/v1/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => { if (j.code === 0) setUser(j.data); else handleLogout() })
      .catch(handleLogout)
      .finally(() => setLoading(false))
  }, [token])

  const handleLoginSuccess = (t: string) => { localStorage.setItem('token', t); setToken(t) }
  
  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    setMenuOpen(false)
    setView('home')
  }

  const [learningProfile, setLearningProfile] = useState<UserLearningProfile | null>(null)
  const [dialogueTypes, setDialogueTypes] = useState<DialogueType[]>([])

  const fetchProfile = () => {
    if (!token || !user || user.role === 'admin') return
    getLearningProfile(token)
      .then(setLearningProfile)
      .catch(() => setLearningProfile(null))
  }

  useEffect(() => {
    fetchProfile()
  }, [token, user])

  useEffect(() => {
    if (learningProfile?.fill_blank_level) {
      setFillBlankLevel(learningProfile.fill_blank_level)
    }
  }, [learningProfile, setFillBlankLevel])

  useEffect(() => {
    if (!token || !user || user.role === 'admin') return
    getDialogueTypes(token)
      .then(setDialogueTypes)
      .catch(() => setDialogueTypes([]))
  }, [token, user])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleStartLearning = async () => {
    setExerciseResult(null)
    // Check if user has an in-progress dialogue
    try {
      const active = await getActiveDialogue(token!)
      if (active) {
        setCurrentDialogue(active.dialogue)
        setPreviewLineIndex(active.current_line_index)
        setView('preview')
        return
      }
    } catch {
      // No active dialogue — fall through to topic selection
    }
    setView('topic-select')
  }

  const handleTopicSelect = (type: DialogueType) => {
    setSelectedTopic(type.name)
    const targets = learningProfile?.target_languages ?? []
    if (targets.length === 0) {
      alert('请先在个人设定中配置学习语言与等级')
      setView('home')
    } else if (targets.length === 1) {
      setSelectedLanguage(targets[0])
      beginGenerate(type.name, targets[0])
    } else {
      setView('language-select')
    }
  }

  const handleLanguageSelect = (lang: TargetLanguage) => {
    setSelectedLanguage(lang)
    beginGenerate(selectedTopic, lang)
  }

  const beginGenerate = async (topic: string, lang: TargetLanguage) => {
    // First check if a shared dialogue already exists for this combo
    try {
      const shared = await getSharedDialogue(token!, topic, lang.lang, lang.level)
      setCurrentDialogue(shared.dialogue)
      setPreviewLineIndex(shared.current_line_index)
      setView('preview')
      return
    } catch {
      // No shared dialogue — generate a new one
    }
    setView('generating')
    setGeneratingError(null)
    try {
      const d = await generateDialogue(token!, { topic, language: lang.lang, level: lang.level })
      setCurrentDialogue(d)
      setPreviewLineIndex(0)
      setView('preview')
    } catch (e: unknown) {
      setGeneratingError((e as Error).message ?? '生成失败')
      setView('home')
    }
  }

  const handleExerciseFinish = (wrongCount: number) => {
    setExerciseResult({ wrongCount })
    setView('home')
    setCurrentDialogue(null)
  }

  if (!token) return <Login onLoginSuccess={handleLoginSuccess} />

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#020617' }}>
      <div style={{ width: '2rem', height: '2rem', border: '3px solid rgba(100,116,139,0.3)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (user?.role === 'admin') return <AdminDashboard token={token} onLogout={handleLogout} user={user} />

  if (currentView === 'preview' && currentDialogue) {
    return (
      <DialoguePreview
        token={token}
        dialogue={currentDialogue}
        initialLineIndex={previewLineIndex}
        learningProfile={learningProfile}
        onStart={() => {
          // Mark as started (upsert progress at current line index, not completed)
          updateDialogueProgress(token!, currentDialogue.id, previewLineIndex, false)
            .catch(console.warn)
          setView('fill-blank')
        }}
        onRegenerate={(newDialogue) => {
          setCurrentDialogue(newDialogue)
          setPreviewLineIndex(0)
          // Stay on preview
        }}
        onSelectNewTopic={() => {
          setCurrentDialogue(null)
          setView('topic-select')
        }}
        onBack={() => {
          setCurrentDialogue(null)
          setView('home')
        }}
      />
    )
  }

  if (currentView === 'fill-blank' && currentDialogue) {
    return (
      <FillBlankExercise
        key={`${currentDialogue.id}-${previewLineIndex}`}
        token={token}
        dialogue={currentDialogue}
        fillBlankLevel={fillBlankLevel}
        initialLineIndex={previewLineIndex}
        onFinish={handleExerciseFinish}
        onLevelChange={setFillBlankLevel}
        onBack={() => {
          setView('home')
          setCurrentDialogue(null)
        }}
      />
    )
  }

  if (currentView === 'review') {
    return <ReviewExercise token={token} fillBlankLevel={fillBlankLevel} onFinish={() => setView('home')} />
  }

  if (currentView === 'history') {
    return (
      <LearningHistory
        token={token}
        onSelectDialogue={(d) => {
          setCurrentDialogue(d)
          setPreviewLineIndex(0)
          setView('fill-blank')
        }}
        onBack={() => setView('home')}
      />
    )
  }

  if (currentView === 'grammar') {
    return <GrammarDashboard token={token} onBack={() => setView('home')} />
  }

  const activeTargetLang = learningProfile?.target_languages?.[0]

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
      `}</style>

      <header style={{ borderBottom: '1px solid rgba(100,116,139,0.15)', background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 50, padding: '0 1.5rem', height: '4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'white', fontSize: '0.875rem' }}>L</div>
          <span style={{ fontWeight: 700, fontSize: '1.125rem', background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>LangStudy</span>
        </div>
        
        {user && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '0.75rem',
                border: '1px solid rgba(100,116,139,0.25)',
                background: 'rgba(30,41,59,0.4)',
                color: '#e2e8f0',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              👤 {learningProfile?.nickname || user.username} ▾
            </button>

            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  marginTop: '0.5rem',
                  width: '180px',
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(100,116,139,0.25)',
                  background: 'rgba(15,23,42,0.95)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  padding: '0.5rem',
                  zIndex: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                <button
                  onClick={() => {
                    setShowProfileModal(true)
                    setMenuOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.625rem 0.875rem',
                    border: 'none',
                    background: 'transparent',
                    color: '#e2e8f0',
                    fontSize: '0.875rem',
                    textAlign: 'left',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(124,58,237,0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  ⚙️ 个人设定
                </button>
                <div style={{ height: '1px', background: 'rgba(100,116,139,0.15)', margin: '0.25rem 0' }} />
                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.625rem 0.875rem',
                    border: 'none',
                    background: 'transparent',
                    color: '#ef4444',
                    fontSize: '0.875rem',
                    textAlign: 'left',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  🚪 退出登录
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '3rem 1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem', animation: 'fadeIn 0.5s ease' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, background: 'linear-gradient(135deg,#60a5fa,#a78bfa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.75rem' }}>
            AI 对话语言学习
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>
            通过 AI 生成的真实对话练习，掌握地道表达
          </p>
        </div>

        {exerciseResult && (
          <div style={{ marginBottom: '2rem', padding: '1rem 1.5rem', borderRadius: '0.875rem', border: exerciseResult.wrongCount === 0 ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(245,158,11,0.3)', background: exerciseResult.wrongCount === 0 ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', animation: 'fadeIn 0.4s ease' }}>
            <p style={{ fontWeight: 700, color: exerciseResult.wrongCount === 0 ? '#86efac' : '#fcd34d' }}>
              {exerciseResult.wrongCount === 0 ? '🎉 全部正确！' : `📝 本次错误 ${exerciseResult.wrongCount} 句，已加入复习队列`}
            </p>
          </div>
        )}

        {generatingError && (
          <div style={{ marginBottom: '2rem', padding: '1rem 1.5rem', borderRadius: '0.875rem', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)' }}>
            <p style={{ color: '#fca5a5', fontWeight: 600 }}>⚠️ 生成失败：{generatingError}</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem', marginBottom: '3rem' }}>
          <ActionCard
            id="btn-start-learning"
            emoji="🎓"
            title="今日学习"
            desc="AI 生成新对话，开始填空练习"
            gradient="linear-gradient(135deg,#1e3a8a,#312e81)"
            hoverGradient="linear-gradient(135deg,#1d4ed8,#4c1d95)"
            onClick={handleStartLearning}
          />
          <ActionCard
            id="btn-start-review"
            emoji="🔄"
            title="今日复习"
            desc="复习已学错题，巩固记忆"
            gradient="linear-gradient(135deg,#1a2e1a,#1a2a2e)"
            hoverGradient="linear-gradient(135deg,#14532d,#0c4a6e)"
            onClick={() => setView('review')}
          />
          <ActionCard
            id="btn-start-grammar"
            emoji="📖"
            title="文章语法分析"
            desc="分析英语段落，学习语法并进行完形填空测试"
            gradient="linear-gradient(135deg,#2d1a3c,#1e113c)"
            hoverGradient="linear-gradient(135deg,#5c1d7c,#2c0c4d)"
            onClick={() => setView('grammar')}
          />
          <ActionCard
            id="btn-start-history"
            emoji="📚"
            title="浏览学习历史"
            desc="浏览并回顾已经学过的对话"
            gradient="linear-gradient(135deg,#2e1a47,#1a1a2e)"
            hoverGradient="linear-gradient(135deg,#581c87,#1e1b4b)"
            onClick={() => setView('history')}
          />
        </div>

        {activeTargetLang && (
          <div style={{ padding: '1rem 1.5rem', borderRadius: '0.875rem', border: '1px solid rgba(100,116,139,0.15)', background: 'rgba(30,41,59,0.3)', textAlign: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>
              当前配置：母语 <strong>{learningProfile?.native_language === 'zh' ? '中文' : learningProfile?.native_language.toUpperCase()}</strong> | 
              目标语言 <strong>{activeTargetLang.lang === 'ja' ? '日语' : '英语'} ({LEVEL_LABELS[activeTargetLang.level]})</strong>
            </span>
          </div>
        )}
      </main>

      {currentView === 'topic-select' && (
        <TopicSelectModal
          types={dialogueTypes}
          onSelect={handleTopicSelect}
          onClose={() => setView('home')}
        />
      )}
      {currentView === 'language-select' && (
        <LanguageSelectModal
          languages={learningProfile?.target_languages ?? []}
          onSelect={handleLanguageSelect}
          onClose={() => setView('home')}
        />
      )}
      {currentView === 'generating' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
          <div style={{ width: '3rem', height: '3rem', border: '3px solid rgba(124,58,237,0.3)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#c4b5fd', fontWeight: 700, fontSize: '1.125rem' }}>AI 正在生成对话...</p>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.5rem' }}>同时生成语音，请稍候（约 30-60 秒）</p>
          </div>
        </div>
      )}

      {showProfileModal && (
        <UserProfileModal
          token={token}
          initialProfile={learningProfile}
          onSave={(updated) => {
            setLearningProfile(updated)
            fetchProfile()
          }}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  )
}

function ActionCard({
  id, emoji, title, desc, gradient, hoverGradient, onClick,
}: {
  id: string; emoji: string; title: string; desc: string
  gradient: string; hoverGradient: string; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      id={id}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '1.75rem 1.5rem',
        borderRadius: '1rem',
        textAlign: 'left',
        border: '1px solid rgba(100,116,139,0.15)',
        background: hovered ? hoverGradient : gradient,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 12px 32px rgba(0,0,0,0.4)' : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: '2.5rem' }}>{emoji}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '1.125rem', color: '#f1f5f9', marginBottom: '0.375rem' }}>{title}</div>
        <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>{desc}</div>
      </div>
    </button>
  )
}
