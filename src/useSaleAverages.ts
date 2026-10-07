import { useMemo } from 'react'
import { fetchSaleAverages, type SaleAverageLookup } from './api/history'
import type { ServerId } from './api/servers'
import { useKeyedFetch } from './useKeyedFetch'

/** Last week's average sale prices per quality; `averages` is undefined until loaded. */
export function useSaleAverages(server: ServerId, items: string[], locations: string[], qualities: readonly number[]) {
  const key = [server, items.join(','), locations.join(','), qualities.join(',')].join('|')
  const { data, ...rest } = useKeyedFetch(key, (signal) =>
    fetchSaleAverages({ server, items, locations, qualities, signal }),
  )
  const averages = useMemo<SaleAverageLookup | undefined>(
    () => (data ? (id, city, quality) => data.get(`${id}|${city}|${quality}`) : undefined),
    [data],
  )
  return { averages, ...rest }
}
