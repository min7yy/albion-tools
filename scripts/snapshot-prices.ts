// Saves every weapon and gear price (all qualities, every market city) plus last week's sale
// history for one server, so the Build guide can be tested offline against real data.
// Run by .github/workflows/snapshot.yml, which publishes the folder to the snapshots branch.
// Usage: node --experimental-strip-types scripts/snapshot-prices.ts <server> <folder>
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { API, batchUrls, buildGuideItemIds, getAll, historyDate, query } from './aodp.ts'

const [server, folder] = process.argv.slice(2)
if (!server || !folder) throw new Error('Usage: snapshot-prices.ts <server> <folder>')
const apiBase = API[server]
if (!apiBase) throw new Error(`Unknown server ${server}`)

const ids = await buildGuideItemIds()
const prices = await getAll(batchUrls(`${apiBase}/api/v2/stats/prices/`, ids, query()))
const since = historyDate(Date.now() - 7 * 86_400_000)
const history = await getAll(batchUrls(`${apiBase}/api/v2/stats/history/`, ids, query({ 'time-scale': '24', date: since })))
await mkdir(folder, { recursive: true })
const takenAt = new Date().toISOString()
await writeFile(join(folder, `${server}-prices.json.gz`), gzipSync(JSON.stringify({ takenAt, rows: prices })))
await writeFile(join(folder, `${server}-history.json.gz`), gzipSync(JSON.stringify({ takenAt, rows: history })))
console.log(`${server}: ${ids.length} items, ${prices.length} price rows, ${history.length} history series`)
