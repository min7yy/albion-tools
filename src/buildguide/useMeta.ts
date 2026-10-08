import { useEffect, useState } from 'react'
import type { FightSize, MetaSummary } from '../meta/aggregate'
import type { CommunityPicks } from '../meta/community'

export type FightFilter = 'all' | FightSize

export const FIGHT_FILTERS: { id: FightFilter; label: string }[] = [
  { id: 'all', label: 'All fights' },
  { id: 's', label: 'Solo' },
  { id: 'm', label: 'Small group (2–5)' },
  { id: 'l', label: 'Large (6+)' },
]

/** Kill data per server, published by .github/workflows/meta.yml. */
const metaUrl = (server: string) => `https://raw.githubusercontent.com/min7yy/albion-tools/meta-data/${server}.json`

/** Skill picks from community builds, refreshed daily by the same workflow. */
const COMMUNITY_URL = 'https://raw.githubusercontent.com/min7yy/albion-tools/meta-data/community.json'
import type { ServerId } from '../api/servers'

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

/** Skill picks from community builds; null until loaded or if unavailable (the guide works without). */
export function useCommunityPicks(): CommunityPicks | null {
  const [picks, setPicks] = useState<CommunityPicks | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch(COMMUNITY_URL, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<CommunityPicks>) : null))
      .then((p) => setPicks(p))
      .catch(() => {})
    return () => controller.abort()
  }, [])
  return picks
}
