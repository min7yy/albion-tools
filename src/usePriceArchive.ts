import { useMemo } from 'react'
import { archiveLookup, archiveUrl, type ArchiveLookup, type PriceArchive } from './api/archive'
import type { ServerId } from './api/servers'
import { useKeyedFetch } from './useKeyedFetch'

/** Last-seen sell orders saved by the price archive job; undefined until loaded or if there is none. */
export function usePriceArchive(server: ServerId): ArchiveLookup | undefined {
  const { data } = useKeyedFetch(server, (signal) =>
    fetch(archiveUrl(server), { signal }).then((res) => (res.ok ? (res.json() as Promise<PriceArchive>) : null)),
  )
  return useMemo(() => (data ? archiveLookup(data) : undefined), [data])
}
