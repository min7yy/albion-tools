// Shared by the price scripts: which items to fetch and how to fetch them politely.
// Kept here rather than imported from src: the site's modules use extensionless imports Node can't run.
import { readFile } from 'node:fs/promises'

export const API: Record<string, string> = {
  americas: 'https://west.albion-online-data.com',
  europe: 'https://europe.albion-online-data.com',
  asia: 'https://east.albion-online-data.com',
}
export const CITIES = ['Bridgewatch', 'Fort Sterling', 'Lymhurst', 'Martlock', 'Thetford', 'Caerleon', 'Brecilien']

/** prefix + comma-joined items + suffix, split so no URL passes 4,000 characters. */
export function batchUrls(prefix: string, items: string[], suffix: string): string[] {
  const budget = 4000 - prefix.length - suffix.length
  const urls: string[] = []
  let batch: string[] = []
  let length = 0
  for (const item of items) {
    const added = encodeURIComponent(item).length + (batch.length ? 1 : 0)
    if (batch.length && length + added > budget) {
      urls.push(prefix + batch.join(',') + suffix)
      batch = []
      length = 0
    }
    batch.push(encodeURIComponent(item))
    length += encodeURIComponent(item).length + (batch.length > 1 ? 1 : 0)
  }
  if (batch.length) urls.push(prefix + batch.join(',') + suffix)
  return urls
}

export const historyDate = (time: number) => {
  const d = new Date(time)
  return `${d.getUTCMonth() + 1}-${d.getUTCDate()}-${d.getUTCFullYear()}`
}

const read = async (path: string) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))

/** Every weapon and gear item id the Build guide prices. */
export async function buildGuideItemIds(): Promise<string[]> {
  const weapons = (await read('../src/data/weapons.json')).weapons as { base: string; variants: [number, number][] }[]
  const gear = (await read('../src/data/gear.json')).gear as { base: string; variants: [number, number][] }[]
  return [...weapons, ...gear].flatMap((w) =>
    w.variants.map(([tier, ench]) => (ench ? `T${tier}_${w.base}@${ench}` : `T${tier}_${w.base}`)),
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Fetches every URL in turn, retrying on errors and rate limits. */
export async function getAll(urls: string[]): Promise<unknown[]> {
  const rows: unknown[] = []
  for (const [i, url] of urls.entries()) {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch((e) => e as Error)
      if (!(res instanceof Error) && res.ok) {
        rows.push(...((await res.json()) as unknown[]))
        break
      }
      const why = res instanceof Error ? res.message : res.status
      if (attempt >= 5) throw new Error(`${url}: ${why}`)
      console.warn(`${i + 1}/${urls.length} ${why}, retrying`)
      // 429 means the per-minute limit; wait it out.
      await sleep(attempt * 15_000)
    }
    // Stay well under the API's 180 requests a minute.
    await sleep(500)
  }
  return rows
}

/** Query string for every market city and quality. */
export const query = (extra: Record<string, string> = {}) =>
  '.json?' + new URLSearchParams({ locations: CITIES.join(','), qualities: '1,2,3,4,5', ...extra }).toString()
