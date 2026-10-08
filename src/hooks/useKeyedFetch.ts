import { useCallback, useEffect, useState } from 'react'

interface FetchState<T> {
  /** The request this data answers; data for any other request is stale. */
  key: string
  data: T | null
  error: string | null
  fetchedAt: Date | null
}

const EMPTY: FetchState<never> = { key: '', data: null, error: null, fetchedAt: null }

/**
 * Runs `load` whenever `key` changes (or on reload). While a new request is in flight it
 * reports loading and no data, so results for an earlier key are never shown as current.
 * `load` must depend only on what `key` describes.
 */
export function useKeyedFetch<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<FetchState<T>>(EMPTY)
  const [reloadKey, setReloadKey] = useState(0)
  const fullKey = `${key}#${reloadKey}`

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
      .then((data) => setState({ key: fullKey, data, error: null, fetchedAt: new Date() }))
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        setState({ key: fullKey, data: null, error: e instanceof Error ? e.message : String(e), fetchedAt: null })
      })
    return () => controller.abort()
    // `load` is rebuilt every render; `fullKey` captures everything it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])
  const current = state.key === fullKey ? state : EMPTY
  return { data: current.data, error: current.error, fetchedAt: current.fetchedAt, loading: state.key !== fullKey, reload }
}
