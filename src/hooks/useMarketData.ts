import { useMemo } from 'react'
import { fetchSalesVolume, type SalesLookup } from '../api/history'
import { fetchPrices, type Price } from '../api/prices'
import type { ServerId } from '../api/servers'
import { useKeyedFetch } from './useKeyedFetch'

const NO_PRICES: Price[] = []

/** Fetches prices for the items and cities on a server; refetches when any change. */
export function usePrices(server: ServerId, items: string[], locations: string[], qualities: readonly number[] = [1]) {
  const key = [server, items.join(','), locations.join(','), qualities.join(',')].join('|')
  const { data, ...rest } = useKeyedFetch(key, (signal) =>
    fetchPrices({ server, items, locations, qualities: [...qualities], signal }),
  )
  return { prices: data ?? NO_PRICES, ...rest }
}

/** Daily sales volume for items in cities; `sales` is undefined until it has loaded. */
export function useSalesVolume(server: ServerId, items: string[], locations: string[]) {
  const key = [server, items.join(','), locations.join(',')].join('|')
  const { data, ...rest } = useKeyedFetch(key, (signal) => fetchSalesVolume({ server, items, locations, signal }))
  const sales = useMemo<SalesLookup | undefined>(
    () => (data ? (id, city) => data.get(`${id}|${city}`) : undefined),
    [data],
  )
  return { sales, ...rest }
}
