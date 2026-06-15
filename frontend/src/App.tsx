import { useState, useEffect } from 'react'
import { Radio } from 'antd'
import Login from './pages/Login'
import AdminDashboard from './components/AdminDashboard'

interface UserProfile {
  id: number
  username: string
  role: string
  created_at: string
}

interface DialogueSegment {
  text: string
  isBlank: boolean
  blankLevel: number
}

interface DialogueItem {
  id: number
  role: 'speakerA' | 'speakerB'
  translation: string
  segments: DialogueSegment[]
}

const mockDialogues: DialogueItem[] = [
  {
    id: 1,
    role: 'speakerA',
    translation: 'Hello, how are you today?',
    segments: [
      { text: 'Bonjour', isBlank: true, blankLevel: 1 },
      { text: 'comment', isBlank: true, blankLevel: 2 },
      { text: 'allez-vous', isBlank: true, blankLevel: 3 },
      { text: 'aujourd\'hui?', isBlank: false, blankLevel: 1 }
    ]
  },
  {
    id: 2,
    role: 'speakerB',
    translation: 'I am doing well, thank you!',
    segments: [
      { text: 'Je', isBlank: true, blankLevel: 1 },
      { text: 'vais', isBlank: true, blankLevel: 2 },
      { text: 'bien', isBlank: true, blankLevel: 3 },
      { text: 'merci!', isBlank: false, blankLevel: 1 }
    ]
  }
]

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<UserProfile | null>(null)
  const [currentLevel, setCurrentLevel] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }

    const fetchProfile = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/v1/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        const result = await response.json()
        if (response.ok && result.code === 0) {
          setUser(result.data)
        } else {
          handleLogout()
        }
      } catch {
        handleLogout()
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [token])

  const handleLoginSuccess = (newToken: string) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="animate-spin h-8 w-8 text-blue-500 rounded-full border-4 border-slate-800 border-t-blue-500" />
      </div>
    )
  }

  if (user && user.role === 'admin') {
    return <AdminDashboard token={token} onLogout={handleLogout} user={user} />
  }


  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center font-bold text-white">
              L
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400">
              LangStudy
            </span>
          </div>

          {user && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-300">
                Logged in as <strong className="text-white">{user.username}</strong>
              </span>
              <button
                onClick={handleLogout}
                className="rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8 flex flex-col space-y-8">
        <div className="rounded-xl border border-slate-900 bg-slate-900/20 backdrop-blur-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Difficulty Control</h2>
            <p className="text-xs text-slate-400 mt-1">Adjust fill-in-the-blank level threshold</p>
          </div>
          <div className="flex items-center">
            <Radio.Group
              value={currentLevel}
              onChange={(e) => setCurrentLevel(Number(e.target.value))}
              buttonStyle="solid"
            >
              <Radio.Button value={1} className="cursor-pointer">Level 1</Radio.Button>
              <Radio.Button value={2} className="cursor-pointer">Level 2</Radio.Button>
              <Radio.Button value={3} className="cursor-pointer">Level 3</Radio.Button>
            </Radio.Group>
          </div>
        </div>

        <div className="flex flex-col space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Study Dialogue</h3>
            <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-xs text-blue-400">
              Current Level: {currentLevel}
            </span>
          </div>

          <div className="space-y-4">
            {mockDialogues.map((dialogue) => (
              <div
                key={dialogue.id}
                className={`flex flex-col p-4 rounded-xl border ${
                  dialogue.role === 'speakerA'
                    ? 'border-blue-900/30 bg-blue-950/10 self-start mr-12'
                    : 'border-violet-900/30 bg-violet-950/10 self-end ml-12'
                } w-full max-w-lg`}
              >
                <div className="flex flex-wrap gap-2 mb-2">
                  {dialogue.segments.map((seg, idx) => {
                    const shouldBlank = seg.isBlank && currentLevel >= seg.blankLevel
                    return (
                      <span
                        key={idx}
                        className={`px-2 py-1 rounded text-sm ${
                          shouldBlank
                            ? 'bg-slate-900 border border-dashed border-slate-700 text-transparent'
                            : 'bg-slate-900/40 text-slate-200'
                        }`}
                      >
                        {shouldBlank ? '________' : seg.text}
                      </span>
                    )
                  })}
                </div>
                <div className="text-xs text-slate-400 mt-2 border-t border-slate-900 pt-2">
                  {dialogue.translation}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
