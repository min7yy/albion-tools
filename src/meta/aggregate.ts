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

interface KillItem {
  Type: string
}
interface KillPlayer {
  Id: string
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

/** [kills, deaths] per fight size. */
export type WeaponStats = Partial<Record<FightSize, [number, number]>>
/** gear[weapon][slot][item] = times seen together. */
export type GearCounts = Record<string, Partial<Record<GearSlot, Record<string, number>>>>

export interface DayStats {
  events: number
  weapons: Record<string, WeaponStats>
  gear: GearCounts
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

function record(day: DayStats, player: KillPlayer, size: FightSize, outcome: 0 | 1) {
  const main = player.Equipment?.MainHand?.Type
  if (!main) return
  const weapon = itemBase(main)
  if (!isWeapon(weapon)) return
  const stats = (day.weapons[weapon] ??= {})
  const pair = (stats[size] ??= [0, 0])
  pair[outcome]++
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
    for (const slots of Object.values(state.days[date].gear)) {
      for (const slot of GEAR_SLOTS) {
        if (slots[slot]) slots[slot] = topEntries(slots[slot], GEAR_PER_DAY)
      }
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
  weapons: Record<string, { stats: WeaponStats; gear: Partial<Record<GearSlot, [string, number][]>> }>
}

export function summarize(state: MetaState, server: string, now: Date): MetaSummary {
  const dates = Object.keys(state.days).sort()
  const stats: Record<string, WeaponStats> = {}
  const gear: GearCounts = {}
  let events = 0
  for (const date of dates) {
    const day = state.days[date]
    events += day.events
    for (const [weapon, s] of Object.entries(day.weapons)) {
      const total = (stats[weapon] ??= {})
      for (const size of FIGHT_SIZES) {
        const add = s[size]
        if (!add) continue
        const pair = (total[size] ??= [0, 0])
        pair[0] += add[0]
        pair[1] += add[1]
      }
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
    weapons[weapon] = { stats: stats[weapon], gear: top }
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
