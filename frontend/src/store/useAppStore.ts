import { create } from 'zustand'
import type { Dialogue, TargetLanguage, AuthUser, UserLearningProfile, DialogueType } from '../types'

export type AppView =
  | 'home'
  | 'topic-select'
  | 'language-select'
  | 'generating'
  | 'preview'
  | 'fill-blank'
  | 'review'
  | 'history'
  | 'grammar'

interface AppState {
  // Auth & User Session
  token: string | null
  user: AuthUser | null
  learningProfile: UserLearningProfile | null
  dialogueTypes: DialogueType[]

  // Navigation (Deprecated in favor of react-router-dom, but kept for partial compatibility if needed)
  currentView: AppView

  // Dialogue selection
  selectedTopic: string
  selectedLanguage: TargetLanguage | null
  currentDialogue: Dialogue | null
  previewLineIndex: number

  // Exercise
  fillBlankLevel: number
  generatingError: string | null
  exerciseResult: { wrongCount: number } | null

  // Actions
  setToken: (token: string | null) => void
  setUser: (user: AuthUser | null) => void
  setLearningProfile: (profile: UserLearningProfile | null) => void
  setDialogueTypes: (types: DialogueType[]) => void
  setView: (view: AppView) => void
  setSelectedTopic: (topic: string) => void
  setSelectedLanguage: (lang: TargetLanguage | null) => void
  setCurrentDialogue: (d: Dialogue | null) => void
  setPreviewLineIndex: (idx: number) => void
  setFillBlankLevel: (level: number) => void
  setGeneratingError: (msg: string | null) => void
  setExerciseResult: (r: { wrongCount: number } | null) => void
  reset: () => void
}

const initialState = {
  token: localStorage.getItem('token'),
  user: null,
  learningProfile: null,
  dialogueTypes: [],
  currentView: 'home' as AppView,
  selectedTopic: '',
  selectedLanguage: null,
  currentDialogue: null,
  previewLineIndex: 0,
  fillBlankLevel: 1,
  generatingError: null,
  exerciseResult: null,
}

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
    set({ token })
  },
  setUser: (user) => set({ user }),
  setLearningProfile: (learningProfile) => set({ learningProfile }),
  setDialogueTypes: (dialogueTypes) => set({ dialogueTypes }),
  setView: (view) => set({ currentView: view }),
  setSelectedTopic: (topic) => set({ selectedTopic: topic }),
  setSelectedLanguage: (lang) => set({ selectedLanguage: lang }),
  setCurrentDialogue: (d) => set({ currentDialogue: d }),
  setPreviewLineIndex: (idx) => set({ previewLineIndex: idx }),
  setFillBlankLevel: (level) => set({ fillBlankLevel: level }),
  setGeneratingError: (msg) => set({ generatingError: msg }),
  setExerciseResult: (r) => set({ exerciseResult: r }),
  reset: () => {
    localStorage.removeItem('token')
    set({ ...initialState, token: null })
  },
}))
