import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { getLearningProfile, getDialogueTypes } from '../services/api'

export function useUserData() {
  const user = useAppStore(state => state.user)
  const { setLearningProfile, setDialogueTypes } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshData = useCallback(async () => {
    if (!user || user.role === 'admin') return
    setLoading(true)
    setError(null)
    try {
      const [profile, types] = await Promise.all([
        getLearningProfile('').catch(() => null),
        getDialogueTypes('').catch(() => []),
      ])
      setLearningProfile(profile)
      setDialogueTypes(types)
    } catch (err: any) {
      setError(err.message ?? '加载用户数据失败')
    } finally {
      setLoading(false)
    }
  }, [user, setLearningProfile, setDialogueTypes])

  useEffect(() => {
    refreshData()
  }, [user, refreshData])

  return {
    loading,
    error,
    refreshData,
  }
}
