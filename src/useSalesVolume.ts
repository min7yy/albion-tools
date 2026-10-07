import { useMemo } from 'react'
import { fetchSalesVolume, type SalesLookup } from './api/history'
import type { ServerId } from './api/servers'
import { useKeyedFetch } from './useKeyedFetch'

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
