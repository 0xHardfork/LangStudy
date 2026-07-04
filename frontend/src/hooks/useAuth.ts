import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { getProfile } from '../services/api'

export function useAuth() {
  const { setUser, reset } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      setError(null)
      try {
        const userProfile = await getProfile('')
        setUser(userProfile)
      } catch (err: any) {
        reset()
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [setUser, reset])

  const logout = async () => {
    try {
      await fetch('/api/v1/logout', { method: 'POST' })
    } catch (err) {
      console.warn('logout failed', err)
    }
    reset()
  }

  return {
    loading,
    error,
    logout,
  }
}
