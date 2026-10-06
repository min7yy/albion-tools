import { getServer, type ServerId } from './servers'

/** One row as returned by GET /api/v2/stats/prices/{items}. */
export interface RawPrice {
  item_id: string
  city: string
  quality: number
  sell_price_min: number
  sell_price_min_date: string
  sell_price_max: number
  sell_price_max_date: string
  buy_price_min: number
  buy_price_min_date: string
  buy_price_max: number
  buy_price_max_date: string
}

/** A cleaned-up price: zero prices and the API's "never seen" dates become null. */
export interface Price {
  itemId: string
  city: string
  quality: number
  /** Cheapest sell order (what you pay to buy instantly). */
  sellMin: number | null
  sellMinDate: Date | null
  /** Highest buy order (what you get selling instantly). */
  buyMax: number | null
  buyMaxDate: Date | null
}

export interface FetchPricesOptions {
  server: ServerId
  items: string[]
  locations: string[]
  qualities?: number[]
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

// The API rejects very long URLs, so item lists are split into batches.
const MAX_URL_LENGTH = 4000

function parseDate(value: string, price: number): Date | null {
  if (!price || !value || value.startsWith('0001-01-01')) return null
  // API dates are UTC but carry no timezone suffix.
  const date = new Date(value.endsWith('Z') ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function normalizePrice(raw: RawPrice): Price {
  return {
    itemId: raw.item_id,
    city: raw.city,
    quality: raw.quality,
    sellMin: raw.sell_price_min || null,
    sellMinDate: parseDate(raw.sell_price_min_date, raw.sell_price_min),
    buyMax: raw.buy_price_max || null,
    buyMaxDate: parseDate(raw.buy_price_max_date, raw.buy_price_max),
  }
}

export function buildPriceUrls(
  apiBase: string,
  items: string[],
  locations: string[],
  qualities: number[] = [1],
): string[] {
  const query = new URLSearchParams({
    locations: locations.join(','),
    qualities: qualities.join(','),
  }).toString()
  const prefix = `${apiBase}/api/v2/stats/prices/`
  const suffix = `.json?${query}`
  const budget = MAX_URL_LENGTH - prefix.length - suffix.length

  const urls: string[] = []
  let batch: string[] = []
  let length = 0
  for (const item of items) {
    const encoded = encodeURIComponent(item)
    const added = encoded.length + (batch.length ? 1 : 0)
    if (batch.length && length + added > budget) {
      urls.push(prefix + batch.join(',') + suffix)
      batch = []
      length = 0
    }
    length += encoded.length + (batch.length ? 1 : 0)
    batch.push(encoded)
  }
  if (batch.length) urls.push(prefix + batch.join(',') + suffix)
  return urls
}

export async function fetchPrices({
  server,
  items,
  locations,
  qualities,
  signal,
  fetchImpl = fetch,
}: FetchPricesOptions): Promise<Price[]> {
  if (!items.length) return []
  const urls = buildPriceUrls(getServer(server).apiBase, items, locations, qualities)
  const results: Price[] = []
  // Sequential on purpose: the API rate limits per IP.
  for (const url of urls) {
    const res = await fetchImpl(url, { signal })
    if (res.status === 429) throw new Error('Price API rate limit hit, wait a minute and retry.')
    if (!res.ok) throw new Error(`Price API error ${res.status}`)
    const rows = (await res.json()) as RawPrice[]
    results.push(...rows.map(normalizePrice))
  }
  return results
}

/** Lookup helper: prices keyed by `${itemId}|${city}`. */
export function indexPrices(prices: Price[]): Map<string, Price> {
  return new Map(prices.map((p) => [`${p.itemId}|${p.city}`, p]))
}
