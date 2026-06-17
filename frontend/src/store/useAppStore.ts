import { create } from 'zustand'
import type { Dialogue, TargetLanguage } from '../types'

export type AppView =
  | 'home'
  | 'topic-select'
  | 'language-select'
  | 'generating'
  | 'fill-blank'
  | 'review'
  | 'history'

interface AppState {
  currentView: AppView
  selectedTopic: string
  selectedLanguage: TargetLanguage | null
  currentDialogue: Dialogue | null
  fillBlankLevel: number
  generatingError: string | null
  exerciseResult: { wrongCount: number } | null

  setView: (view: AppView) => void
  setSelectedTopic: (topic: string) => void
  setSelectedLanguage: (lang: TargetLanguage | null) => void
  setCurrentDialogue: (d: Dialogue | null) => void
  setFillBlankLevel: (level: number) => void
  setGeneratingError: (msg: string | null) => void
  setExerciseResult: (r: { wrongCount: number } | null) => void
  reset: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'home',
  selectedTopic: '',
  selectedLanguage: null,
  currentDialogue: null,
  fillBlankLevel: 1,
  generatingError: null,
  exerciseResult: null,

  setView: (view) => set({ currentView: view }),
  setSelectedTopic: (topic) => set({ selectedTopic: topic }),
  setSelectedLanguage: (lang) => set({ selectedLanguage: lang }),
  setCurrentDialogue: (d) => set({ currentDialogue: d }),
  setFillBlankLevel: (level) => set({ fillBlankLevel: level }),
  setGeneratingError: (msg) => set({ generatingError: msg }),
  setExerciseResult: (r) => set({ exerciseResult: r }),
  reset: () =>
    set({
      currentView: 'home',
      selectedTopic: '',
      selectedLanguage: null,
      currentDialogue: null,
      generatingError: null,
    }),
}))
