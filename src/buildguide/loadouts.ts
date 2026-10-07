import { FIGHT_SIZES, GEAR_SLOTS, totalFights, type MetaSummary, type WeaponStats } from '../meta/aggregate'
import { GEAR, type Gear } from './gear'
import type { FightFilter } from './meta'
import type { TargetSet } from './target'
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

/** A whole loadout seen in recent kills. */
export interface Loadout {
  /** The off-hand (one-handed weapons only), helmet, armour, shoes and cape, one item per slot. */
  gear: Gear[][]
  wins: number
  losses: number
  fights: number
  /** Win rate pulled toward 50% by PRIOR_FIGHTS; use this to rank. */
  winRate: number
}

export function shrunkWinRate(wins: number, fights: number): number {
  return (wins + PRIOR_FIGHTS / 2) / (fights + PRIOR_FIGHTS)
}

function pick(stats: WeaponStats, fight: FightFilter): [number, number] {
  let wins = 0
  let losses = 0
  for (const size of FIGHT_SIZES) {
    if (fight !== 'all' && size !== fight) continue
    wins += stats[size]?.[0] ?? 0
    losses += stats[size]?.[1] ?? 0
  }
  return [wins, losses]
}

/**
 * A weapon's most worn complete loadouts for a fight size, most worn first. Loadouts with an
 * empty slot or an item we have no data for (event skins, for example) are left out.
 */
export function loadoutsFor(weapon: Weapon, summary: MetaSummary, fight: FightFilter, min = MIN_FIGHTS): Loadout[] {
  const out: Loadout[] = []
  for (const [bases, stats] of summary.weapons[weapon.base]?.builds ?? []) {
    if (!totalFights(stats)) continue
    const [wins, losses] = pick(stats, fight)
    const fights = wins + losses
    if (fights < min) continue
    const gear: Gear[][] = []
    let complete = true
    GEAR_SLOTS.forEach((slot, i) => {
      if (slot === 'OffHand' && weapon.twoHanded) return
      const item = GEAR.get(bases[i])
      if (item?.slot === slot) gear.push([item])
      else complete = false
    })
    if (complete) out.push({ gear, wins, losses, fights, winRate: shrunkWinRate(wins, fights) })
  }
  return out.sort((a, b) => b.fights - a.fights)
}

export type SortMode = 'recommended' | 'winrate' | 'popularity' | 'cheapest'

export const SORT_MODES: { id: SortMode; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'winrate', label: 'Win rate' },
  { id: 'popularity', label: 'Most played' },
  { id: 'cheapest', label: 'Cheapest' },
]

/** Recommended weighs how often a build wins, how much it's played and how cheaply it reaches the target. */
export const WEIGHTS = { winRate: 0.4, popularity: 0.3, price: 0.3 }

export interface BuildRow {
  weapon: Weapon
  /** Null when the weapon has too few recorded fights, so the set uses its usual gear slot by slot. */
  loadout: Loadout | null
  set: TargetSet
}

export type RankedBuild = BuildRow & { score: number }

export function rankBuilds(rows: BuildRow[], sort: SortMode): RankedBuild[] {
  const minPrice = Math.min(...rows.map((r) => r.set.price))
  const maxFights = Math.max(1, ...rows.map((r) => r.loadout?.fights ?? 0))
  const rates = rows.flatMap((r) => (r.loadout ? [r.loadout.winRate] : []))
  const [lo, hi] = rates.length ? [Math.min(...rates), Math.max(...rates)] : [0.5, 0.5]
  const ranked = rows.map((r) => {
    const win = r.loadout && hi > lo ? (r.loadout.winRate - lo) / (hi - lo) : 0
    const popularity = r.loadout ? r.loadout.fights / maxFights : 0
    const cheap = r.set.price > 0 ? minPrice / r.set.price : 1
    return { ...r, score: WEIGHTS.winRate * win + WEIGHTS.popularity * popularity + WEIGHTS.price * cheap }
  })
  const byPrice = (a: RankedBuild, b: RankedBuild) => a.set.price - b.set.price || a.weapon.name.localeCompare(b.weapon.name)
  const by: Record<SortMode, (a: RankedBuild, b: RankedBuild) => number> = {
    recommended: (a, b) => b.score - a.score || byPrice(a, b),
    winrate: (a, b) => (b.loadout?.winRate ?? 0) - (a.loadout?.winRate ?? 0) || byPrice(a, b),
    popularity: (a, b) => (b.loadout?.fights ?? 0) - (a.loadout?.fights ?? 0) || byPrice(a, b),
    cheapest: byPrice,
  }
  return ranked.sort(by[sort])
}
