// Downloads every community build from Albion Free Market and writes the skill picks per item to
// <folder>/community.json, at most once a day. Run by .github/workflows/meta.yml before the kill
// collector. Usage: node --experimental-strip-types scripts/collect-community.ts <folder>
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { countPicks, type CommunityBuild, type CommunityPicks } from '../src/meta/community.ts'

const API = process.env.COMMUNITY_URL ?? 'https://api.albionfreemarket.com/be/builds'
const PAGE = 200
const MAX_PAGES = 100
const REFRESH_HOURS = 24

const folder = process.argv[2]
if (!folder) throw new Error('Usage: collect-community.ts <folder>')
const out = join(folder, 'community.json')

try {
  const previous = JSON.parse(await readFile(out, 'utf8')) as CommunityPicks
  if (Date.now() - Date.parse(previous.updatedAt) < REFRESH_HOURS * 3600_000) {
    console.log(`community.json is from ${previous.updatedAt}; skipping`)
    process.exit(0)
  }
} catch {
  // No previous file: collect.
}

interface Page {
  builds: CommunityBuild[]
  nextCursor?: { lastValue: number | string; lastId: string } | null
}

const builds: CommunityBuild[] = []
let cursor: Page['nextCursor'] = null
for (let page = 0; page < MAX_PAGES; page++) {
  const params = new URLSearchParams({ limit: String(PAGE), sortBy: 'upvotes' })
  if (cursor) {
    params.set('cursorLastValue', String(cursor.lastValue))
    params.set('cursorLastId', cursor.lastId)
  }
  const res = await fetch(`${API}?${params}`, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`${API}: ${res.status}`)
  const body = (await res.json()) as Page
  builds.push(...body.builds)
  cursor = body.nextCursor
  if (!cursor || body.builds.length < PAGE) break
  // Be gentle with a site we don't run.
  await new Promise((r) => setTimeout(r, 1500))
}
const picks = countPicks(builds, new Date())
await writeFile(out, JSON.stringify(picks))
console.log(`Counted ${picks.builds} of ${builds.length} community builds over ${Object.keys(picks.items).length} items`)
