import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { getProfile } from '../services/api'

export function useAuth() {
  const { token, setToken, setUser, reset } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }

    const fetchUser = async () => {
      setLoading(true)
      setError(null)
      try {
        const userProfile = await getProfile(token)
        setUser(userProfile)
      } catch (err: any) {
        // Clear session on failed auth
        reset()
        setError(err.message ?? '身份验证失败')
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [token, setToken, setUser, reset])

  const logout = () => {
    reset()
  }

  return {
    loading,
    error,
    logout,
  }
}
