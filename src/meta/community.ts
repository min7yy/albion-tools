// Skill picks from community builds on Albion Free Market (albionfreemarket.com/builds). Shared by
// scripts/collect-community.ts and the site, so it imports nothing.

/** One build as the Free Market API returns it (only the fields read here). */
export interface CommunityBuild {
  netVotes?: number
  slots?: {
    slotType: string
    mainItemSelection?: { itemUniqueName?: string; selectedSpells?: { uniqueName: string }[] }
  }[]
}

/** items[item base] = [builds that use the item, picks per spell]. */
export interface CommunityPicks {
  updatedAt: string
  /** Builds counted. */
  builds: number
  items: Record<string, [number, Record<string, number>]>
}

const base = (type: string) => type.replace(/^T\d+_/, '').replace(/@\d+$/, '')

/** Counts which spells each item is built with. Builds voted below zero are left out. */
export function countPicks(builds: CommunityBuild[], now: Date): CommunityPicks {
  const items: CommunityPicks['items'] = {}
  let counted = 0
  for (const build of builds) {
    if ((build.netVotes ?? 0) < 0) continue
    counted++
    for (const slot of build.slots ?? []) {
      const sel = slot.mainItemSelection
      if (!sel?.itemUniqueName) continue
      const entry = (items[base(sel.itemUniqueName)] ??= [0, {}])
      entry[0]++
      for (const spell of new Set((sel.selectedSpells ?? []).map((s) => s.uniqueName))) {
        entry[1][spell] = (entry[1][spell] ?? 0) + 1
      }
    }
  }
  return { updatedAt: now.toISOString(), builds: counted, items }
}
