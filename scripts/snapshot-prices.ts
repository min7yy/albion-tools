// Saves every weapon and gear price (all qualities, every market city) plus last week's sale
// history for one server, so the Build guide can be tested offline against real data.
// Run by .github/workflows/snapshot.yml, which publishes the folder to the snapshots branch.
// Usage: node --experimental-strip-types scripts/snapshot-prices.ts <server> <folder>
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

// Kept here rather than imported: the site's modules use extensionless imports Node can't run.
const API: Record<string, string> = {
  americas: 'https://west.albion-online-data.com',
  europe: 'https://europe.albion-online-data.com',
  asia: 'https://east.albion-online-data.com',
}
const CITIES = ['Bridgewatch', 'Fort Sterling', 'Lymhurst', 'Martlock', 'Thetford', 'Caerleon', 'Brecilien']

/** prefix + comma-joined items + suffix, split so no URL passes 4,000 characters. */
function batchUrls(prefix: string, items: string[], suffix: string): string[] {
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

const historyDate = (time: number) => {
  const d = new Date(time)
  return `${d.getUTCMonth() + 1}-${d.getUTCDate()}-${d.getUTCFullYear()}`
}

const [server, folder] = process.argv.slice(2)
if (!server || !folder) throw new Error('Usage: snapshot-prices.ts <server> <folder>')

const read = async (path: string) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
const weapons = (await read('../src/data/weapons.json')).weapons as { base: string; variants: [number, number][] }[]
const gear = (await read('../src/data/gear.json')).gear as { base: string; variants: [number, number][] }[]
const ids = [...weapons, ...gear].flatMap((w) =>
  w.variants.map(([tier, ench]) => (ench ? `T${tier}_${w.base}@${ench}` : `T${tier}_${w.base}`)),
)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getAll(urls: string[]): Promise<unknown[]> {
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

const apiBase = API[server]
if (!apiBase) throw new Error(`Unknown server ${server}`)
const query = (extra: Record<string, string>) =>
  '.json?' + new URLSearchParams({ locations: CITIES.join(','), qualities: '1,2,3,4,5', ...extra }).toString()
const prices = await getAll(batchUrls(`${apiBase}/api/v2/stats/prices/`, ids, query({})))
const since = historyDate(Date.now() - 7 * 86_400_000)
const history = await getAll(batchUrls(`${apiBase}/api/v2/stats/history/`, ids, query({ 'time-scale': '24', date: since })))
await mkdir(folder, { recursive: true })
const takenAt = new Date().toISOString()
await writeFile(join(folder, `${server}-prices.json.gz`), gzipSync(JSON.stringify({ takenAt, rows: prices })))
await writeFile(join(folder, `${server}-history.json.gz`), gzipSync(JSON.stringify({ takenAt, rows: history })))
console.log(`${server}: ${ids.length} items, ${prices.length} price rows, ${history.length} history series`)
