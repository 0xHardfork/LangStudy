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
  token: null,
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

  setToken: (_token) => {
    set({ token: null })
  },
  setUser: (user) => set({ user }),
  setLearningProfile: (learningProfile) => {
    const fillBlankLevel = learningProfile?.fill_blank_level ?? 1
    set({ learningProfile, fillBlankLevel })
  },
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
    set({ ...initialState, token: null, user: null })
  },
}))
