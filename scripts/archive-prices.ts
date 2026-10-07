// Adds the current weapon and gear sell orders for each server to its archive, keeping the last
// one seen per item, city and quality for a week. Run by .github/workflows/price-archive.yml,
// which publishes the folder to the price-archive branch for the Build guide to fall back on.
// Usage: node --experimental-strip-types scripts/archive-prices.ts <folder> <server>...
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { mergeIntoArchive, type PriceArchive } from '../src/api/archive.ts'
import { API, batchUrls, buildGuideItemIds, getAll, query } from './aodp.ts'

const [folder, ...servers] = process.argv.slice(2)
if (!folder || !servers.length) throw new Error('Usage: archive-prices.ts <folder> <server>...')

const ids = await buildGuideItemIds()
await mkdir(folder, { recursive: true })
for (const server of servers) {
  const apiBase = API[server]
  if (!apiBase) throw new Error(`Unknown server ${server}`)
  const file = join(folder, `${server}.json`)
  const previous = (await readFile(file, 'utf8').then(JSON.parse, () => null)) as PriceArchive | null
  const rows = (await getAll(batchUrls(`${apiBase}/api/v2/stats/prices/`, ids, query()))) as Parameters<typeof mergeIntoArchive>[1]
  const archive = mergeIntoArchive(previous, rows, Date.now())
  await writeFile(file, JSON.stringify(archive))
  const kept = Object.values(archive.items).reduce((n, list) => n + list.length, 0)
  const fresh = rows.filter((r) => r.sell_price_min).length
  console.log(`${server}: ${fresh} sell orders now, ${kept} kept in the archive`)
}
