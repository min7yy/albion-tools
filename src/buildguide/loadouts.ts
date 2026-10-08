import {
  FIGHT_SIZES,
  filterStats,
  GEAR_SLOTS,
  IP_BRACKETS,
  IP_STEP,
  parseStatKey,
  type FightSize,
  type GearSlot,
  type MetaSummary,
  type StatsFilter,
  type WeaponStats,
} from '../meta/aggregate'
import { GEAR, type Gear } from './gear'
import { usualGear } from './sets'
import type { Weapon } from './weapons'

/** Fights a loadout needs before it's listed: fewer and one lucky streak tops the table. */
export const MIN_FIGHTS = 8
/**
 * Win rates are pulled toward 50% as if every loadout had this many extra fights split evenly,
 * so 9 wins from 10 doesn't outrank 300 from 500.
 */
export const PRIOR_FIGHTS = 20

export function shrunkWinRate(wins: number, fights: number): number {
  return (wins + PRIOR_FIGHTS / 2) / (fights + PRIOR_FIGHTS)
}

/** Fights a loadout needs within one item power bracket before it's listed there. */
export const MIN_BRACKET_FIGHTS = 5

/** A weapon with one item per gear slot, and how it has done in recent kills. */
export interface SetRow {
  /** Off-hand (one-handed weapons only), helmet, armour, shoes and cape. */
  gear: Gear[]
  wins: number
  losses: number
  fights: number
  /** Win rate pulled toward 50% by PRIOR_FIGHTS; use this to rank. */
  winRate: number
  /** Average item power of the players wearing it, where the kill data records it. */
  itemPower: number | null
  /** True when no exact loadout has enough fights, so this is the weapon's most worn item per slot. */
  usual: boolean
}

/** The best set in one item power bracket, and the weapon's own record there. */
export interface BracketRow {
  bracket: (typeof IP_BRACKETS)[number]
  /** Null when no loadout has MIN_BRACKET_FIGHTS in the bracket. */
  set: SetRow | null
  wins: number
  losses: number
}

/** A weapon card: its record, its best set overall and its best set at each item power. */
export interface WeaponRow {
  weapon: Weapon
  wins: number
  losses: number
  fights: number
  winRate: number
  itemPower: number | null
  /** [wins, losses] per fight size, for the detail view. */
  bySize: Record<FightSize, [number, number]>
  best: SetRow | null
  brackets: BracketRow[]
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

function setRow(gear: Gear[], stats: WeaponStats, filter: StatsFilter, usual: boolean): SetRow {
  const [wins, losses] = filterStats(stats, filter)
  const fights = wins + losses
  return { gear, wins, losses, fights, winRate: shrunkWinRate(wins, fights), itemPower: averageIp(stats, filter), usual }
}

/**
 * A weapon's recorded loadouts with an item in every slot. Loadouts with an empty slot or an
 * item we have no data for (event skins, for example) are left out.
 */
function completeSets(weapon: Weapon, summary: MetaSummary): { gear: Gear[]; stats: WeaponStats }[] {
  const out: { gear: Gear[]; stats: WeaponStats }[] = []
  for (const [bases, stats] of summary.weapons[weapon.base]?.builds ?? []) {
    const gear: Gear[] = []
    let complete = true
    GEAR_SLOTS.forEach((slot, i) => {
      if (slot === 'OffHand' && weapon.twoHanded) return
      const item = GEAR.get(bases[i])
      if (item?.slot === slot) gear.push(item)
      else complete = false
    })
    if (complete) out.push({ gear, stats })
  }
  return out
}

/** The loadout with the best (shrunk) win rate among those with at least `min` fights. */
function bestSet(weapon: Weapon, summary: MetaSummary, filter: StatsFilter, min: number): SetRow | null {
  let best: SetRow | null = null
  for (const { gear, stats } of completeSets(weapon, summary)) {
    const r = setRow(gear, stats, filter, false)
    if (r.fights >= min && (!best || r.winRate > best.winRate || (r.winRate === best.winRate && r.fights > best.fights))) best = r
  }
  return best
}

/**
 * A weapon's card for one fight size, or null when it has no fights there. The best set falls back
 * to the weapon's most worn item per slot, with its own record, when no loadout has MIN_FIGHTS.
 */
export function weaponRow(weapon: Weapon, summary: MetaSummary, size: FightSize | 'all'): WeaponRow | null {
  const stats = summary.weapons[weapon.base]?.stats
  if (!stats) return null
  const filter: StatsFilter = { size }
  const [wins, losses] = filterStats(stats, filter)
  const fights = wins + losses
  if (!fights) return null
  const bySize = {} as Record<FightSize, [number, number]>
  for (const s of FIGHT_SIZES) bySize[s] = filterStats(stats, { ...filter, size: s })
  const best =
    bestSet(weapon, summary, filter, MIN_FIGHTS) ??
    setRow(usualGear(weapon, summary), stats, filter, true)
  const brackets = IP_BRACKETS.map((bracket): BracketRow => {
    const inBracket = { size, itemPower: bracket }
    const [w, l] = filterStats(stats, inBracket)
    return { bracket, set: bestSet(weapon, summary, inBracket, MIN_BRACKET_FIGHTS), wins: w, losses: l }
  })
  return { weapon, wins, losses, fights, winRate: shrunkWinRate(wins, fights), itemPower: averageIp(stats, filter), bySize, best, brackets }
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

interface Rankable {
  weapon: Weapon
  fights: number
  winRate: number
}

export function rankBuilds<T extends Rankable>(rows: T[], sort: SortMode): (T & { score: number })[] {
  const maxFights = Math.max(1, ...rows.map((r) => r.fights))
  const rates = rows.map((r) => r.winRate)
  const [lo, hi] = rates.length ? [Math.min(...rates), Math.max(...rates)] : [0.5, 0.5]
  const ranked = rows.map((r) => {
    const win = hi > lo ? (r.winRate - lo) / (hi - lo) : 0
    // Square root so a handful of hugely popular builds don't flatten everyone else.
    const popularity = Math.sqrt(r.fights / maxFights)
    return { ...r, score: WEIGHTS.winRate * win + WEIGHTS.popularity * popularity }
  })
  type Ranked = T & { score: number }
  const byFights = (a: Ranked, b: Ranked) => b.fights - a.fights || a.weapon.name.localeCompare(b.weapon.name)
  const by: Record<SortMode, (a: Ranked, b: Ranked) => number> = {
    recommended: (a, b) => b.score - a.score || byFights(a, b),
    winrate: (a, b) => b.winRate - a.winRate || byFights(a, b),
    popularity: byFights,
  }
  return ranked.sort(by[sort])
}
