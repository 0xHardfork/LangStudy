import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'

interface HeaderProps {
  onShowProfileModal: () => void
  onLogout: () => void
}

export default function Header({ onShowProfileModal, onLogout }: HeaderProps) {
  const user = useAppStore((state) => state.user)
  const learningProfile = useAppStore((state) => state.learningProfile)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 h-16 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center font-extrabold text-white text-sm">
          L
        </div>
        <span className="font-bold text-lg bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
          LangStudy
        </span>
      </div>
      
      {user && (
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 bg-slate-900/40 text-slate-200 text-sm font-semibold cursor-pointer transition-all duration-150 hover:bg-slate-800 hover:text-white"
          >
            👤 {learningProfile?.nickname || user.username} ▾
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-800 bg-slate-950/95 backdrop-blur-xl shadow-2xl p-2 z-50 flex flex-col gap-1">
              <button
                onClick={() => {
                  onShowProfileModal()
                  setMenuOpen(false)
                }}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-200 text-left rounded-lg bg-transparent cursor-pointer w-full transition-colors duration-150 hover:bg-violet-500/10 hover:text-violet-300"
              >
                ⚙️ 个人设定
              </button>
              <div className="h-px bg-slate-800/60 my-1" />
              <button
                onClick={() => {
                  onLogout()
                  setMenuOpen(false)
                }}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 text-left rounded-lg bg-transparent cursor-pointer w-full transition-colors duration-150 hover:bg-red-500/10"
              >
                🚪 退出登录
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
