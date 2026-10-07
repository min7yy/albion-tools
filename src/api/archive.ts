// Prices the Data Project has dropped. It only keeps the latest sell order for a day or so, so a
// scheduled job (scripts/archive-prices.ts) saves every one it sees to the price-archive branch
// and the site falls back to the last one seen there, marked with its age.
// No imports here: the archive script runs this file under plain Node.

/** The fields of a Data Project price row the archive keeps. */
interface SellRow {
  item_id: string
  city: string
  quality: number
  sell_price_min: number
  sell_price_min_date: string
}

/** How long a sell order is kept after it was last seen. */
export const ARCHIVE_DAYS = 7

/** Per item: [city index, quality, price, minutes since 1970] for the last sell order seen. */
export interface PriceArchive {
  updatedAt: string
  cities: string[]
  items: Record<string, [number, number, number, number][]>
}

export interface ArchivedPrice {
  price: number
  date: Date
}

export type ArchiveLookup = (itemId: string, city: string, quality: number) => ArchivedPrice | undefined

export function archiveUrl(server: string): string {
  return `https://raw.githubusercontent.com/min7yy/albion-tools/price-archive/${server}.json`
}

function rawDate(value: string): number {
  if (!value || value.startsWith('0001-01-01')) return NaN
  return new Date(value.endsWith('Z') ? value : `${value}Z`).getTime()
}

/** Adds the sell orders in rows, keeping the newest per item, city and quality, and drops old ones. */
export function mergeIntoArchive(archive: PriceArchive | null, rows: SellRow[], now: number): PriceArchive {
  const cities = [...(archive?.cities ?? [])]
  const entries = new Map<string, [number, number, number, number]>()
  const key = (itemId: string, city: number, quality: number) => `${itemId}|${city}|${quality}`
  const keep = (itemId: string, entry: [number, number, number, number]) => {
    const k = key(itemId, entry[0], entry[1])
    const old = entries.get(k)
    if (!old || entry[3] > old[3]) entries.set(k, entry)
  }
  for (const [itemId, list] of Object.entries(archive?.items ?? {})) for (const e of list) keep(itemId, e)
  for (const row of rows) {
    const time = rawDate(row.sell_price_min_date)
    if (!row.sell_price_min || !Number.isFinite(time)) continue
    let city = cities.indexOf(row.city)
    if (city < 0) city = cities.push(row.city) - 1
    keep(row.item_id, [city, row.quality, row.sell_price_min, Math.floor(time / 60_000)])
  }
  const cutoff = Math.floor((now - ARCHIVE_DAYS * 86_400_000) / 60_000)
  const items: PriceArchive['items'] = {}
  for (const [k, entry] of entries) {
    if (entry[3] < cutoff) continue
    const itemId = k.slice(0, k.indexOf('|'))
    ;(items[itemId] ??= []).push(entry)
  }
  return { updatedAt: new Date(now).toISOString(), cities, items }
}

export function archiveLookup(archive: PriceArchive): ArchiveLookup {
  const map = new Map<string, ArchivedPrice>()
  for (const [itemId, list] of Object.entries(archive.items)) {
    for (const [city, quality, price, minutes] of list) {
      map.set(`${itemId}|${archive.cities[city]}|${quality}`, { price, date: new Date(minutes * 60_000) })
    }
  }
  return (itemId, city, quality) => map.get(`${itemId}|${city}|${quality}`)
}
