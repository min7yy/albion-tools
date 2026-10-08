import { filterStats, GEAR_SLOTS, IP_STEP, parseStatKey, type FightSize, type GearSlot, type MetaSummary, type StatsFilter, type WeaponStats } from '../meta/aggregate'
import { GEAR, type Gear } from './gear'
import { usualGear } from './sets'
import type { Weapon } from './weapons'

/** Fights a loadout needs before it's listed: fewer and one lucky streak tops the table. */
export const MIN_FIGHTS = 8
/** Loadouts shown per weapon. */
export const BUILDS_PER_WEAPON = 3
/**
 * Win rates are pulled toward 50% as if every loadout had this many extra fights split evenly,
 * so 9 wins from 10 doesn't outrank 300 from 500.
 */
export const PRIOR_FIGHTS = 20

export function shrunkWinRate(wins: number, fights: number): number {
  return (wins + PRIOR_FIGHTS / 2) / (fights + PRIOR_FIGHTS)
}

/** A build card: a weapon with one item per gear slot, and how it has done in recent kills. */
export interface BuildRow {
  weapon: Weapon
  /** Off-hand (one-handed weapons only), helmet, armour, shoes and cape. */
  gear: Gear[]
  wins: number
  losses: number
  fights: number
  /** Win rate pulled toward 50% by PRIOR_FIGHTS; use this to rank. */
  winRate: number
  /** Average item power of the players wearing it, where the kill data records it. */
  itemPower: number | null
  /** [wins, losses] per fight size, for the detail view. */
  bySize: Record<FightSize, [number, number]>
  /** True when no exact loadout has enough fights, so this is the weapon's most worn item per slot. */
  usual: boolean
}

/** Fights where the player's item power was within IP_STEP of `itemPower`, or every fight when null. */
export function statsFilter(size: FightSize | 'all', itemPower: number | null): StatsFilter {
  return { size, ...(itemPower ? { itemPower: { from: itemPower - IP_STEP, to: itemPower + IP_STEP } } : {}) }
}

function averageIp(stats: WeaponStats, filter: StatsFilter): number | null {
  let sum = 0
  let n = 0
  for (const [key, [w, l]] of Object.entries(stats)) {
    const { size, itemPower } = parseStatKey(key)
    if (itemPower === null || (filter.size && filter.size !== 'all' && size !== filter.size)) continue
    if (filter.itemPower && (itemPower < filter.itemPower.from || itemPower >= filter.itemPower.to)) continue
    sum += (itemPower + IP_STEP / 2) * (w + l)
    n += w + l
  }
  return n ? Math.round(sum / n) : null
}

function row(weapon: Weapon, gear: Gear[], stats: WeaponStats, filter: StatsFilter, usual: boolean): BuildRow {
  const [wins, losses] = filterStats(stats, filter)
  const fights = wins + losses
  const bySize = {} as Record<FightSize, [number, number]>
  for (const size of ['s', 'm', 'l'] as const) bySize[size] = filterStats(stats, { ...filter, size })
  return { weapon, gear, wins, losses, fights, winRate: shrunkWinRate(wins, fights), itemPower: averageIp(stats, filter), bySize, usual }
}

/**
 * A weapon's most worn complete loadouts that match the filter, most worn first. Loadouts with an
 * empty slot or an item we have no data for (event skins, for example) are left out. When none
 * has MIN_FIGHTS, the weapon gets one card with its most worn item per slot and its own record.
 */
export function buildsFor(weapon: Weapon, summary: MetaSummary, filter: StatsFilter, min = MIN_FIGHTS): BuildRow[] {
  const out: BuildRow[] = []
  for (const [bases, stats] of summary.weapons[weapon.base]?.builds ?? []) {
    const gear: Gear[] = []
    let complete = true
    GEAR_SLOTS.forEach((slot, i) => {
      if (slot === 'OffHand' && weapon.twoHanded) return
      const item = GEAR.get(bases[i])
      if (item?.slot === slot) gear.push(item)
      else complete = false
    })
    if (!complete) continue
    const r = row(weapon, gear, stats, filter, false)
    if (r.fights >= min) out.push(r)
  }
  if (out.length) return out.sort((a, b) => b.fights - a.fights).slice(0, BUILDS_PER_WEAPON)
  const stats = summary.weapons[weapon.base]?.stats
  if (!stats) return []
  const r = row(weapon, usualGear(weapon, summary, 1).map((slot) => slot[0]), stats, filter, true)
  return r.fights ? [r] : []
}

/** Other items worn with a weapon in one slot, most worn first, with their share of that slot. */
export function alternatives(weapon: Weapon, summary: MetaSummary, slot: GearSlot): { item: Gear; share: number }[] {
  const counts = summary.weapons[weapon.base]?.gear[slot] ?? []
  const total = counts.reduce((n, [, c]) => n + c, 0)
  return counts.flatMap(([base, c]) => {
    const item = GEAR.get(base)
    return item?.slot === slot ? [{ item, share: c / total }] : []
  })
}

export type SortMode = 'recommended' | 'winrate' | 'popularity'

export const SORT_MODES: { id: SortMode; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'winrate', label: 'Win rate' },
  { id: 'popularity', label: 'Most played' },
]

/** Recommended weighs how often a build wins and how much it's played equally. */
export const WEIGHTS = { winRate: 0.5, popularity: 0.5 }

export type RankedBuild = BuildRow & { score: number }

export function rankBuilds(rows: BuildRow[], sort: SortMode): RankedBuild[] {
  const maxFights = Math.max(1, ...rows.map((r) => r.fights))
  const rates = rows.map((r) => r.winRate)
  const [lo, hi] = rates.length ? [Math.min(...rates), Math.max(...rates)] : [0.5, 0.5]
  const ranked = rows.map((r) => {
    const win = hi > lo ? (r.winRate - lo) / (hi - lo) : 0
    // Square root so a handful of hugely popular builds don't flatten everyone else.
    const popularity = Math.sqrt(r.fights / maxFights)
    return { ...r, score: WEIGHTS.winRate * win + WEIGHTS.popularity * popularity }
  })
  const byFights = (a: RankedBuild, b: RankedBuild) => b.fights - a.fights || a.weapon.name.localeCompare(b.weapon.name)
  const by: Record<SortMode, (a: RankedBuild, b: RankedBuild) => number> = {
    recommended: (a, b) => b.score - a.score || byFights(a, b),
    winrate: (a, b) => b.winRate - a.winRate || byFights(a, b),
    popularity: byFights,
  }
  return ranked.sort(by[sort])
}
