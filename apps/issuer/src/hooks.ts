import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { api, getSession, subscribeSession } from './api.ts'

export const useSession = () => useSyncExternalStore(subscribeSession, getSession)

/** Loads a GET resource and exposes loading/error state plus a reload. */
export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    api
      .get<T>(path)
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [path, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { data, error, loading: data === null && error === null, reload }
}
