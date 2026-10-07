import { useCallback, useEffect, useState } from 'react'
import { fetchPrices, type Price } from './api/prices'
import type { ServerId } from './api/servers'

interface PriceState {
  /** The request these prices answer; prices for any other request are stale. */
  key: string
  prices: Price[]
  error: string | null
  fetchedAt: Date | null
}

const EMPTY: PriceState = { key: '', prices: [], error: null, fetchedAt: null }

/**
 * Fetches prices for the items and cities on a server; refetches when any change.
 * While a new request is in flight it reports loading and no prices, so the previous
 * server's or item list's prices are never shown as current.
 */
export function usePrices(server: ServerId, items: string[], locations: string[], qualities: readonly number[] = [1]) {
  const [state, setState] = useState<PriceState>(EMPTY)
  const [reloadKey, setReloadKey] = useState(0)
  const itemsKey = items.join(',')
  const locationsKey = locations.join(',')
  const qualitiesKey = qualities.join(',')
  const key = [server, itemsKey, locationsKey, qualitiesKey, reloadKey].join('|')

  useEffect(() => {
    const controller = new AbortController()
    fetchPrices({
      server,
      items: itemsKey.split(','),
      locations: locationsKey.split(','),
      qualities: qualitiesKey.split(',').map(Number),
      signal: controller.signal,
    })
      .then((prices) => setState({ key, prices, error: null, fetchedAt: new Date() }))
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        setState({ key, prices: [], error: e instanceof Error ? e.message : String(e), fetchedAt: null })
      })
    return () => controller.abort()
  }, [key, server, itemsKey, locationsKey, qualitiesKey])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  const current = state.key === key ? state : EMPTY
  return { prices: current.prices, error: current.error, fetchedAt: current.fetchedAt, loading: state.key !== key, reload }
}
