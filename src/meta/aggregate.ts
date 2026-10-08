// Kill-event aggregation for the builds tracker. Shared by scripts/collect-meta.ts (which runs
// in a scheduled GitHub job) and the site, so it imports nothing.

/** s = solo (1 attacker), m = small group (2–5), l = large fights (6+). */
export type FightSize = 's' | 'm' | 'l'
export const FIGHT_SIZES: FightSize[] = ['s', 'm', 'l']

/** Gear slots recorded next to each weapon. */
export const GEAR_SLOTS = ['OffHand', 'Head', 'Armor', 'Shoes', 'Cape'] as const
export type GearSlot = (typeof GEAR_SLOTS)[number]

/** Days of kill data kept; older days drop off. */
export const WINDOW_DAYS = 7
/** Gear items kept per weapon and slot each day, to bound the file size. */
export const GEAR_PER_DAY = 20
/** Gear items per weapon and slot in the published summary. */
export const GEAR_IN_SUMMARY = 5
/** Whole loadouts kept per weapon each day (most worn first), to bound the file size. */
export const BUILDS_PER_DAY = 40
/** Whole loadouts per weapon in the published summary. */
export const BUILDS_IN_SUMMARY = 12

interface KillItem {
  Type: string
}
interface KillPlayer {
  Id: string
  /** Average item power of the player's gear at the time, spec and quality included. */
  AverageItemPower?: number
  Equipment?: Partial<Record<string, KillItem | null>>
}
/** The parts of a gameinfo /events entry that the tracker reads. */
export interface KillEvent {
  EventId: number
  TimeStamp: string
  numberOfParticipants?: number
  Killer: KillPlayer
  Victim: KillPlayer
  Participants?: KillPlayer[]
}

/** Item power is recorded in steps of this size. */
export const IP_STEP = 100

/**
 * [wins, losses] keyed by fight size and the player's item power rounded down to IP_STEP, as in
 * "s1100". Days recorded before item power was tracked use the bare fight size ("s").
 */
export type WeaponStats = Record<string, [number, number]>

export function statKey(size: FightSize, itemPower?: number): string {
  return itemPower && itemPower > 0 ? `${size}${Math.floor(itemPower / IP_STEP) * IP_STEP}` : size
}

/** Splits a stats key into its fight size and item power step (null on older days). */
export function parseStatKey(key: string): { size: FightSize; itemPower: number | null } {
  return { size: key[0] as FightSize, itemPower: key.length > 1 ? Number(key.slice(1)) : null }
}

export interface StatsFilter {
  /** Fight size, or every size. */
  size?: FightSize | 'all'
  /** Only fights where the player's item power was within this range (inclusive of `from`). */
  itemPower?: { from: number; to: number }
}

/** [wins, losses] over the entries that match the filter. */
export function filterStats(stats: WeaponStats, filter: StatsFilter = {}): [number, number] {
  let wins = 0
  let losses = 0
  for (const [key, [w, l]] of Object.entries(stats)) {
    const { size, itemPower } = parseStatKey(key)
    if (filter.size && filter.size !== 'all' && size !== filter.size) continue
    if (filter.itemPower && (itemPower === null || itemPower < filter.itemPower.from || itemPower >= filter.itemPower.to))
      continue
    wins += w
    losses += l
  }
  return [wins, losses]
}

/** gear[weapon][slot][item] = times seen together. */
export type GearCounts = Record<string, Partial<Record<GearSlot, Record<string, number>>>>

/** builds[weapon][loadout key] = [wins, losses] per fight size; see loadoutKey. */
export type BuildCounts = Record<string, Record<string, WeaponStats>>

export interface DayStats {
  events: number
  weapons: Record<string, WeaponStats>
  gear: GearCounts
  /** Whole loadouts; missing on days recorded before loadouts were tracked. */
  builds?: BuildCounts
}

/** Rolling state kept between job runs. */
export interface MetaState {
  version: 1
  lastEventId: number
  days: Record<string, DayStats>
}

export function emptyState(): MetaState {
  return { version: 1, lastEventId: 0, days: {} }
}

export function fightSize(attackers: number): FightSize {
  if (attackers <= 1) return 's'
  return attackers <= 5 ? 'm' : 'l'
}

/** Item id without tier, enchantment or quality: T6_2H_CLAYMORE_AVALON@2 → 2H_CLAYMORE_AVALON. */
export function itemBase(type: string): string {
  return type.replace(/^T\d+_/, '').replace(/@\d+$/, '')
}

/** Main-hand items that are weapons (gathering tools also sit in the main hand). */
export function isWeapon(base: string): boolean {
  return /^(MAIN|2H)_/.test(base) && !base.includes('TOOL')
}

function attackers(event: KillEvent): KillPlayer[] {
  const seen = new Set<string>()
  const list = event.Participants?.length ? event.Participants : [event.Killer]
  return list.filter((p) => p && !seen.has(p.Id) && seen.add(p.Id))
}

/** The gear around a weapon as one key: off-hand, head, armour, shoes and cape bases joined by '|' (empty where bare). */
export function loadoutKey(player: KillPlayer): string {
  return GEAR_SLOTS.map((slot) => {
    const type = player.Equipment?.[slot]?.Type
    return type ? itemBase(type) : ''
  }).join('|')
}

function addPair(stats: WeaponStats, key: string, outcome: 0 | 1) {
  const pair = (stats[key] ??= [0, 0])
  pair[outcome]++
}

function sumPairs(into: WeaponStats, from: WeaponStats) {
  for (const [key, add] of Object.entries(from)) {
    const pair = (into[key] ??= [0, 0])
    pair[0] += add[0]
    pair[1] += add[1]
  }
}

/** Fights a loadout or weapon appears in, over every fight size and item power. */
export function totalFights(stats: WeaponStats): number {
  let n = 0
  for (const [w, l] of Object.values(stats)) n += w + l
  return n
}

function record(day: DayStats, player: KillPlayer, size: FightSize, outcome: 0 | 1) {
  const main = player.Equipment?.MainHand?.Type
  if (!main) return
  const weapon = itemBase(main)
  if (!isWeapon(weapon)) return
  const key = statKey(size, player.AverageItemPower)
  addPair((day.weapons[weapon] ??= {}), key, outcome)
  const builds = ((day.builds ??= {})[weapon] ??= {})
  addPair((builds[loadoutKey(player)] ??= {}), key, outcome)
  const gear = (day.gear[weapon] ??= {})
  for (const slot of GEAR_SLOTS) {
    const type = player.Equipment?.[slot]?.Type
    if (!type) continue
    const counts = (gear[slot] ??= {})
    const base = itemBase(type)
    counts[base] = (counts[base] ?? 0) + 1
  }
}

/**
 * Adds events newer than `since` (by default the newest event of the previous run) and returns
 * how many were added. A run pages newest first, so it passes the previous run's id on every page.
 */
export function addEvents(state: MetaState, events: KillEvent[], since = state.lastEventId): number {
  let added = 0
  let maxId = state.lastEventId
  for (const event of events) {
    if (event.EventId <= since) continue
    maxId = Math.max(maxId, event.EventId)
    const date = event.TimeStamp.slice(0, 10)
    const day = (state.days[date] ??= { events: 0, weapons: {}, gear: {} })
    const attacking = attackers(event)
    const size = fightSize(event.numberOfParticipants || attacking.length)
    for (const p of attacking) record(day, p, size, 0)
    record(day, event.Victim, size, 1)
    day.events++
    added++
  }
  state.lastEventId = maxId
  return added
}

function topBuilds(builds: Record<string, WeaponStats>, n: number): Record<string, WeaponStats> {
  return Object.fromEntries(
    Object.entries(builds)
      .sort((a, b) => totalFights(b[1]) - totalFights(a[1]) || a[0].localeCompare(b[0]))
      .slice(0, n),
  )
}

function topEntries(counts: Record<string, number>, n: number): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, n),
  )
}

/** Drops days outside the window and trims each day's gear lists. */
export function pruneState(state: MetaState, now: Date): void {
  const oldest = new Date(now.getTime() - (WINDOW_DAYS - 1) * 86400_000).toISOString().slice(0, 10)
  for (const date of Object.keys(state.days)) {
    if (date < oldest) {
      delete state.days[date]
      continue
    }
    const day = state.days[date]
    for (const slots of Object.values(day.gear)) {
      for (const slot of GEAR_SLOTS) {
        if (slots[slot]) slots[slot] = topEntries(slots[slot], GEAR_PER_DAY)
      }
    }
    for (const [weapon, builds] of Object.entries(day.builds ?? {})) {
      day.builds![weapon] = topBuilds(builds, BUILDS_PER_DAY)
    }
  }
}

/** What the site loads: the whole window summed, with the most common gear per weapon. */
export interface MetaSummary {
  server: string
  updatedAt: string
  from: string
  to: string
  events: number
  weapons: Record<
    string,
    {
      stats: WeaponStats
      gear: Partial<Record<GearSlot, [string, number][]>>
      /** Most worn whole loadouts: [off-hand, head, armour, shoes, cape] bases ('' where bare) and their results. */
      builds?: [string[], WeaponStats][]
    }
  >
}

export function summarize(state: MetaState, server: string, now: Date): MetaSummary {
  const dates = Object.keys(state.days).sort()
  const stats: Record<string, WeaponStats> = {}
  const gear: GearCounts = {}
  const builds: BuildCounts = {}
  let events = 0
  for (const date of dates) {
    const day = state.days[date]
    events += day.events
    for (const [weapon, s] of Object.entries(day.weapons)) {
      sumPairs((stats[weapon] ??= {}), s)
    }
    for (const [weapon, list] of Object.entries(day.builds ?? {})) {
      const total = (builds[weapon] ??= {})
      for (const [key, s] of Object.entries(list)) sumPairs((total[key] ??= {}), s)
    }
    for (const [weapon, slots] of Object.entries(day.gear)) {
      const total = (gear[weapon] ??= {})
      for (const slot of GEAR_SLOTS) {
        for (const [item, n] of Object.entries(slots[slot] ?? {})) {
          const counts = (total[slot] ??= {})
          counts[item] = (counts[item] ?? 0) + n
        }
      }
    }
  }
  const weapons: MetaSummary['weapons'] = {}
  for (const weapon of Object.keys(stats).sort()) {
    const top: Partial<Record<GearSlot, [string, number][]>> = {}
    for (const slot of GEAR_SLOTS) {
      const counts = gear[weapon]?.[slot]
      if (counts) top[slot] = Object.entries(topEntries(counts, GEAR_IN_SUMMARY))
    }
    const loadouts = Object.entries(topBuilds(builds[weapon] ?? {}, BUILDS_IN_SUMMARY)).map(
      ([key, s]): [string[], WeaponStats] => [key.split('|'), s],
    )
    weapons[weapon] = { stats: stats[weapon], gear: top, ...(loadouts.length ? { builds: loadouts } : {}) }
  }
  return {
    server,
    updatedAt: now.toISOString(),
    from: dates[0] ?? '',
    to: dates[dates.length - 1] ?? '',
    events,
    weapons,
  }
}
