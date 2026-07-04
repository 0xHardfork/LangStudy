import { useState, useCallback, useRef, useEffect } from 'react'

interface UseRequestOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (err: Error) => void
}

export function useRequest<T, Args extends any[]>(
  requestFn: (...args: Args) => Promise<T>,
  options?: UseRequestOptions<T>
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep track of the latest options using a ref to prevent recreation of run callback
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  // Keep track of the latest requestFn using a ref to prevent recreation of run callback
  const requestFnRef = useRef(requestFn)
  useEffect(() => {
    requestFnRef.current = requestFn
  })

  const run = useCallback(
    async (...args: Args): Promise<T> => {
      setLoading(true)
      setError(null)
      try {
        const result = await requestFnRef.current(...args)
        setData(result)
        optionsRef.current?.onSuccess?.(result)
        return result
      } catch (err: any) {
        const errMsg = err.message || '请求失败，请稍后重试'
        setError(errMsg)
        optionsRef.current?.onError?.(err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [] // Stable across all renders
  )

  const reset = useCallback(() => {
    setData(null)
    setLoading(false)
    setError(null)
  }, [])

  return {
    data,
    loading,
    error,
    run,
    reset,
    setData,
  }
}
