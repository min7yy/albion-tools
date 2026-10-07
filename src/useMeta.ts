import { useEffect, useState } from 'react'
import type { MetaSummary } from './meta/aggregate'
import { metaUrl } from './buildguide/meta'
import type { ServerId } from './api/servers'

interface MetaState {
  summary: MetaSummary | null
  error: string | null
}

/** Kill data published by the builds tracker for a server. */
export function useMeta(server: ServerId): MetaState {
  const [state, setState] = useState<MetaState & { server: ServerId | null }>({ summary: null, error: null, server: null })

  useEffect(() => {
    const controller = new AbortController()
    fetch(metaUrl(server), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Kill data unavailable (${res.status})`)
        return res.json() as Promise<MetaSummary>
      })
      .then((summary) => setState({ summary, error: null, server }))
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        setState({ summary: null, error: e instanceof Error ? e.message : String(e), server })
      })
    return () => controller.abort()
  }, [server])

  // Don't show another server's data while the new one loads.
  return state.server === server ? state : { summary: null, error: null }
}
