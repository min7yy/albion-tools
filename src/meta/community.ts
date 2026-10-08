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
/** Bumped when the file gains fields, so the collector refreshes it straight away. */
export const COMMUNITY_VERSION = 2

export interface CommunityPicks {
  version?: number
  updatedAt: string
  /** Builds counted. */
  builds: number
  items: Record<string, [number, Record<string, number>]>
  /** consumables[weapon base] = potions and food picked in builds with that weapon; older files lack it. */
  consumables?: Record<string, Consumables>
}

export interface Consumables {
  builds: number
  Potion: Record<string, number>
  Food: Record<string, number>
}

const CONSUMABLE_SLOTS = { potion: 'Potion', food: 'Food' } as const

const base = (type: string) => type.replace(/^T\d+_/, '').replace(/@\d+$/, '')

/** Counts which spells each item is built with. Builds voted below zero are left out. */
export function countPicks(builds: CommunityBuild[], now: Date): CommunityPicks {
  const items: CommunityPicks['items'] = {}
  const consumables: Record<string, Consumables> = {}
  let counted = 0
  for (const build of builds) {
    if ((build.netVotes ?? 0) < 0) continue
    counted++
    const main = build.slots?.find((s) => s.slotType === 'mainhand')?.mainItemSelection?.itemUniqueName
    if (main) {
      const c = (consumables[base(main)] ??= { builds: 0, Potion: {}, Food: {} })
      c.builds++
      for (const slot of build.slots ?? []) {
        const kind = CONSUMABLE_SLOTS[slot.slotType as keyof typeof CONSUMABLE_SLOTS]
        const item = slot.mainItemSelection?.itemUniqueName
        if (kind && item) c[kind][base(item)] = (c[kind][base(item)] ?? 0) + 1
      }
    }
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
  return { version: COMMUNITY_VERSION, updatedAt: now.toISOString(), builds: counted, items, consumables }
}
