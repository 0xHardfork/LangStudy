import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { getLearningProfile, getDialogueTypes } from '../services/api'

export function useUserData() {
  const token = useAppStore(state => state.token)
  const user = useAppStore(state => state.user)
  const { setLearningProfile, setDialogueTypes } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshData = useCallback(async () => {
    if (!token || !user || user.role === 'admin') return
    setLoading(true)
    setError(null)
    try {
      const [profile, types] = await Promise.all([
        getLearningProfile(token).catch(() => null),
        getDialogueTypes(token).catch(() => []),
      ])
      setLearningProfile(profile)
      setDialogueTypes(types)
    } catch (err: any) {
      setError(err.message ?? '加载用户数据失败')
    } finally {
      setLoading(false)
    }
  }, [token, user, setLearningProfile, setDialogueTypes])

  useEffect(() => {
    refreshData()
  }, [token, user, refreshData])

  return {
    loading,
    error,
    refreshData,
  }
}
