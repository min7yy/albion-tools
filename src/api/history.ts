import { batchItemUrls } from './prices'
import { getServer, type ServerId } from './servers'

/** One series as returned by GET /api/v2/stats/history/{items}?time-scale=24. */
export interface RawHistory {
  location: string
  item_id: string
  quality: number
  data: { item_count: number; avg_price: number; timestamp: string }[]
}

/** Recent trading for one item in one market. */
export interface SalesVolume {
  /** Average items sold per day over the window (days with no trades count as zero). */
  perDay: number
  /** Volume-weighted average sale price over the window, or null with no sales. */
  avgPrice: number | null
}

/** Sales volume keyed by `${itemId}|${city}`. */
export type SalesLookup = (itemId: string, city: string) => SalesVolume | undefined

const VOLUME_DAYS = 7

export function buildHistoryUrls(
  apiBase: string,
  items: string[],
  locations: string[],
  quality: number | readonly number[] = 1,
  /** First day to return, as the API's M-D-YYYY; omitted for its default range. */
  since?: string,
): string[] {
  const query = new URLSearchParams({
    locations: locations.join(','),
    qualities: Array.isArray(quality) ? quality.join(',') : String(quality),
    'time-scale': '24',
    ...(since ? { date: since } : {}),
  }).toString()
  return batchItemUrls(`${apiBase}/api/v2/stats/history/`, items, `.json?${query}`)
}

/** Sums the last `days` days of daily history (counted back from `now`) into a per-day average. */
export function summarizeHistory(series: RawHistory, now: number, days = VOLUME_DAYS): SalesVolume {
  const since = now - days * 86_400_000
  let count = 0
  let silver = 0
  for (const point of series.data) {
    const t = new Date(point.timestamp.endsWith('Z') ? point.timestamp : `${point.timestamp}Z`).getTime()
    if (!(t >= since)) continue
    count += point.item_count
    silver += point.item_count * point.avg_price
  }
  return { perDay: count / days, avgPrice: count ? silver / count : null }
}

export interface FetchHistoryOptions {
  server: ServerId
  items: string[]
  locations: string[]
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  now?: number
}

/**
 * Daily sales volume for normal-quality items. Item and city pairs the API has no
 * history for are reported as zero sales, since the history covers every trade it saw.
 */
export async function fetchSalesVolume({
  server,
  items,
  locations,
  signal,
  fetchImpl = fetch,
  now = Date.now(),
}: FetchHistoryOptions): Promise<Map<string, SalesVolume>> {
  const volumes = new Map<string, SalesVolume>()
  if (!items.length) return volumes
  for (const id of items) for (const city of locations) volumes.set(`${id}|${city}`, { perDay: 0, avgPrice: null })
  // Sequential on purpose: the API rate limits per IP.
  for (const url of buildHistoryUrls(getServer(server).apiBase, items, locations)) {
    const res = await fetchImpl(url, { signal })
    if (res.status === 429) throw new Error('Sales history rate limit hit, wait a minute and retry.')
    if (!res.ok) throw new Error(`Sales history error ${res.status}`)
    for (const series of (await res.json()) as RawHistory[]) {
      if (series.quality !== 1) continue
      volumes.set(`${series.item_id}|${series.location}`, summarizeHistory(series, now))
    }
  }
  return volumes
}
