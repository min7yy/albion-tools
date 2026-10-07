import { useCallback, useEffect, useState } from 'react'
import { fetchPrices, type Price } from './api/prices'
import type { ServerId } from './api/servers'

interface PriceState {
  prices: Price[]
  loading: boolean
  error: string | null
  fetchedAt: Date | null
}

/** Fetches prices for the items and cities on a server; refetches when any change. */
export function usePrices(server: ServerId, items: string[], locations: string[], qualities: readonly number[] = [1]) {
  const [state, setState] = useState<PriceState>({ prices: [], loading: true, error: null, fetchedAt: null })
  const [reloadKey, setReloadKey] = useState(0)
  const itemsKey = items.join(',')
  const locationsKey = locations.join(',')
  const qualitiesKey = qualities.join(',')

  useEffect(() => {
    const controller = new AbortController()
    fetchPrices({
      server,
      items: itemsKey.split(','),
      locations: locationsKey.split(','),
      qualities: qualitiesKey.split(',').map(Number),
      signal: controller.signal,
    })
      .then((prices) => setState({ prices, loading: false, error: null, fetchedAt: new Date() }))
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) }))
      })
    return () => controller.abort()
  }, [server, itemsKey, locationsKey, qualitiesKey, reloadKey])

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }))
    setReloadKey((k) => k + 1)
  }, [])

  return { ...state, reload }
}
