import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import DialoguePreview from './pages/DialoguePreview'
import FillBlankExercise from './pages/FillBlankExercise'
import ReviewExercise from './pages/ReviewExercise'
import UserProfileModal from './components/UserProfileModal'
import LearningHistory from './pages/LearningHistory'
import GrammarDashboard from './pages/GrammarDashboard'
import Home from './pages/Home'
import Header from './components/layout/Header'
import { useAuth } from './hooks/useAuth'
import { useUserData } from './hooks/useUserData'
import { useAppStore } from './store/useAppStore'
import { updateDialogueProgress } from './services/api'

const RequireAuth = () => {
  const user = useAppStore((state) => state.user)
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

const RequireAdmin = () => {
  const user = useAppStore((state) => state.user)
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

const RequireUser = () => {
  const user = useAppStore((state) => state.user)
  if (user && user.role === 'admin') return <Navigate to="/admin" replace />
  return <Outlet />
}

function AppContent() {
  const { token, user, currentDialogue, fillBlankLevel, previewLineIndex, learningProfile } = useAppStore()
  const { setUser, setCurrentDialogue, setPreviewLineIndex, setExerciseResult, setFillBlankLevel, setLearningProfile } = useAppStore()
  const [showProfileModal, setShowProfileModal] = useState(false)
  const { loading, logout } = useAuth()
  const { refreshData } = useUserData()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#020617' }}>
        <div style={{ width: '2rem', height: '2rem', border: '3px solid rgba(100,116,139,0.3)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to="/" replace /> : <Login onLoginSuccess={(u) => setUser(u)} />
        } />

        {/* Protected Routes */}
        <Route element={<RequireAuth />}>
          {/* Admin Route */}
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminDashboard onLogout={logout} user={user!} />} />
          </Route>

          {/* Normal User Routes */}
          <Route element={<RequireUser />}>
            <Route element={
              <div style={{ minHeight: '100vh', background: '#020617', color: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif' }}>
                <Header onShowProfileModal={() => setShowProfileModal(true)} onLogout={logout} />
                <Outlet />
              </div>
            }>
              <Route path="/" element={<Home />} />
              
              <Route path="/preview" element={
                currentDialogue ? (
                  <DialoguePreview
                    dialogue={currentDialogue}
                    initialLineIndex={previewLineIndex}
                    learningProfile={learningProfile}
                    onStart={() => {
                      updateDialogueProgress(token!, currentDialogue.id, previewLineIndex, false)
                        .catch(console.warn)
                      navigate('/fill-blank')
                    }}
                    onRegenerate={(newDialogue) => {
                      setCurrentDialogue(newDialogue)
                      setPreviewLineIndex(0)
                    }}
                    onSelectNewTopic={() => {
                      setCurrentDialogue(null)
                      navigate('/')
                    }}
                    onBack={() => {
                      setCurrentDialogue(null)
                      navigate('/')
                    }}
                  />
                ) : <Navigate to="/" replace />
              } />

              <Route path="/fill-blank" element={
                currentDialogue ? (
                  <FillBlankExercise
                    key={`${currentDialogue.id}-${previewLineIndex}`}
                    dialogue={currentDialogue}
                    fillBlankLevel={fillBlankLevel}
                    initialLineIndex={previewLineIndex}
                    onFinish={(wrongCount) => {
                      setExerciseResult({ wrongCount })
                      setCurrentDialogue(null)
                      navigate('/')
                    }}
                    onLevelChange={setFillBlankLevel}
                    onBack={() => {
                      setCurrentDialogue(null)
                      navigate('/')
                    }}
                  />
                ) : <Navigate to="/" replace />
              } />

              <Route path="/review" element={
                <ReviewExercise
                  fillBlankLevel={fillBlankLevel}
                  onFinish={() => navigate('/')}
                />
              } />

              <Route path="/history" element={
                <LearningHistory
                  onSelectDialogue={(d) => {
                    setCurrentDialogue(d)
                    setPreviewLineIndex(0)
                    navigate('/fill-blank')
                  }}
                  onBack={() => navigate('/')}
                />
              } />

              <Route path="/grammar" element={
                <GrammarDashboard
                  onBack={() => navigate('/')}
                />
              } />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showProfileModal && (
        <UserProfileModal
          initialProfile={learningProfile}
          onSave={(updated) => {
            setLearningProfile(updated)
            refreshData()
          }}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
