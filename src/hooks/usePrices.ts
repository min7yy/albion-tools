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
