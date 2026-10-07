// Builds tracker: samples recent kills from the official gameinfo API for each server and keeps a
// rolling week of weapon use and gear pairings. Run by .github/workflows/meta.yml, which publishes
// the output folder to the meta-data branch.
// Usage: node --experimental-strip-types scripts/collect-meta.ts <folder>
//   <folder>/<server>-state.json  rolling state between runs (read and rewritten)
//   <folder>/<server>.json        summary the site loads
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { addEvents, emptyState, pruneState, summarize, type KillEvent, type MetaState } from '../src/meta/aggregate.ts'

// GAMEINFO_URL points every server at one host, for testing against a local mock.
const mock = process.env.GAMEINFO_URL
const SERVERS: Record<string, string> = {
  americas: mock ?? 'https://gameinfo.albiononline.com',
  europe: mock ?? 'https://gameinfo-ams.albiononline.com',
  asia: mock ?? 'https://gameinfo-sgp.albiononline.com',
}
// The API returns at most 51 events per page and refuses offsets past 1000.
const PAGE = 51
const MAX_OFFSET = 1000

// Asia alone can log over 1,000 kills in half an hour, more than one pass can page through, so
// a run keeps polling for COLLECT_MINUTES (0 = a single pass) to catch most of them.
const COLLECT_MINUTES = Number(process.env.COLLECT_MINUTES ?? 0)
const POLL_SECONDS = 30

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getPage(base: string, offset: number): Promise<KillEvent[] | null> {
  const url = `${base}/api/gameinfo/events?limit=${PAGE}&offset=${offset}`
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
      if (res.ok) return (await res.json()) as KillEvent[]
      // 4xx past the first page means we've gone past what the API will page through.
      if (res.status < 500) {
        if (offset === 0) throw new Error(`${url}: ${res.status}`)
        return null
      }
      console.warn(`${url}: ${res.status}`)
    } catch (e) {
      console.warn(`${url}: ${e instanceof Error ? e.message : e}`)
    }
    await sleep(2000 * attempt)
  }
  throw new Error(`${url} kept failing`)
}

async function readState(path: string): Promise<MetaState> {
  try {
    const state = JSON.parse(await readFile(path, 'utf8')) as MetaState
    return state.version === 1 ? state : emptyState()
  } catch {
    return emptyState()
  }
}

/** One server's result from this run, written to status.json so a stalled server is easy to spot. */
interface RunStatus {
  at: string
  added: number
  /** Id and time of the newest event the API returned, to tell a stale API from a quiet one. */
  newestEventId?: number
  newestTime?: string
  pages: number
  error?: string
}

/** One pass over the newest events, newest first, until it reaches the previous pass. */
async function collectPass(base: string, state: MetaState, status: RunStatus): Promise<void> {
  const lastSeen = state.lastEventId
  // New kills arrive while we page, pushing events onto the next page, so skip repeats.
  const seen = new Set<number>()
  for (let offset = 0; offset <= MAX_OFFSET; offset += PAGE) {
    const events = await getPage(base, offset)
    status.pages++
    if (!events?.length) break
    if (offset === 0 && events[0].EventId > (status.newestEventId ?? 0)) {
      status.newestEventId = events[0].EventId
      status.newestTime = events[0].TimeStamp
    }
    const fresh = events.filter((e) => !seen.has(e.EventId))
    for (const e of fresh) seen.add(e.EventId)
    status.added += addEvents(state, fresh, lastSeen)
    // Pages run newest first, so stop once we reach events from the previous pass.
    if (events.some((e) => e.EventId <= lastSeen)) break
    await sleep(500)
  }
}

async function save(server: string, state: MetaState, folder: string): Promise<void> {
  const now = new Date()
  pruneState(state, now)
  await writeFile(join(folder, `${server}-state.json`), JSON.stringify(state))
  await writeFile(join(folder, `${server}.json`), JSON.stringify(summarize(state, server, now)))
}

const folder = process.argv[2]
if (!folder) throw new Error('Usage: collect-meta.ts <folder>')
await mkdir(folder, { recursive: true })
const servers = Object.entries(SERVERS)
const statuses: Record<string, RunStatus> = {}
const states: Record<string, MetaState> = {}
for (const [server] of servers) {
  statuses[server] = { at: new Date().toISOString(), added: 0, pages: 0 }
  states[server] = await readState(join(folder, `${server}-state.json`))
}
const until = Date.now() + COLLECT_MINUTES * 60_000
let passes = 0
do {
  if (passes++) await sleep(POLL_SECONDS * 1000)
  for (const [server, base] of servers) {
    const status = statuses[server]
    try {
      await collectPass(base, states[server], status)
      delete status.error
    } catch (e) {
      // One server being down shouldn't lose the others' data; the next pass tries again.
      status.error = e instanceof Error ? e.message : String(e)
      console.error(`${server}: ${status.error}`)
    }
  }
} while (Date.now() < until)

for (const [server] of servers) {
  await save(server, states[server], folder)
  console.log(`${server}: ${statuses[server].added} new events over ${passes} passes`)
}
await writeFile(join(folder, 'status.json'), JSON.stringify({ passes, servers: statuses }, null, 1))
if (servers.every(([server]) => statuses[server].error)) process.exit(1)
