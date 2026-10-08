import type { ExtraSlot, MetaSummary, WeaponSummary } from '../meta/aggregate'
import { shrunkWinRate } from './loadouts'
import { extraItem } from './spells'
import { WEAPONS, type Weapon } from './weapons'

const WEAPON_BY_BASE = new Map(WEAPONS.map((w) => [w.base, w]))

/** Fights a weapon needs over the window before it's called rising or falling. */
export const TREND_MIN_FIGHTS = 30
/** Days at the end of the window compared with the days before them. */
export const TREND_RECENT_DAYS = 2
/** Change in share of all fights that counts as rising (or, inverted, falling). */
export const TREND_RATIO = 1.3

/**
 * Whether a weapon is being played more or less lately: its share of all fights over the last
 * TREND_RECENT_DAYS against its share over the days before. Null when there isn't enough data.
 */
export function trendOf(weapon: string, summary: MetaSummary): { dir: 'up' | 'down'; ratio: number } | null {
  const series = summary.weapons[weapon]?.trend
  const days = summary.dates?.length ?? 0
  if (!series || days <= TREND_RECENT_DAYS) return null
  const totals = new Array<number>(days).fill(0)
  for (const w of Object.values(summary.weapons)) w.trend?.forEach(([a, b], d) => (totals[d] += a + b))
  const split = days - TREND_RECENT_DAYS
  const sum = (from: number, to: number, f: (d: number) => number) => {
    let n = 0
    for (let d = from; d < to; d++) n += f(d)
    return n
  }
  const mine = (d: number) => series[d][0] + series[d][1]
  const fights = sum(0, days, mine)
  const before = sum(0, split, (d) => totals[d])
  const recent = sum(split, days, (d) => totals[d])
  if (fights < TREND_MIN_FIGHTS || !before || !recent) return null
  const ratio = sum(split, days, mine) / recent / (sum(0, split, mine) / before || Infinity)
  if (ratio >= TREND_RATIO) return { dir: 'up', ratio }
  if (ratio > 0 && ratio <= 1 / TREND_RATIO) return { dir: 'down', ratio }
  return null
}

export interface Performance {
  /** Average damage and healing per kill the weapon took part in. */
  damage: number | null
  healing: number | null
  /** Average fame of the players it landed the killing blow on. */
  killFame: number | null
}

export function performanceOf(w: WeaponSummary | undefined): Performance | null {
  const p = w?.perf
  if (!p) return null
  const [damage, healing, attacks, fame, blows] = p
  return {
    damage: attacks ? damage / attacks : null,
    healing: attacks ? healing / attacks : null,
    killFame: blows ? fame / blows : null,
  }
}

export interface Matchup {
  opponent: Weapon
  wins: number
  losses: number
  winRate: number
}

/** Fights against one weapon before it's listed as a matchup. */
export const MATCHUP_MIN_FIGHTS = 3

/** Opponent weapons it beats and loses to most (killing blows only), best first and worst first. */
export function matchupsOf(w: WeaponSummary | undefined, n = 3): { strong: Matchup[]; weak: Matchup[] } {
  const list: Matchup[] = []
  for (const [base, wins, losses] of w?.matchups ?? []) {
    const opponent = WEAPON_BY_BASE.get(base)
    if (!opponent || wins + losses < MATCHUP_MIN_FIGHTS) continue
    list.push({ opponent, wins, losses, winRate: shrunkWinRate(wins, wins + losses) })
  }
  const strong = list.filter((m) => m.wins > m.losses).sort((a, b) => b.winRate - a.winRate)
  const weak = list.filter((m) => m.losses > m.wins).sort((a, b) => a.winRate - b.winRate)
  return { strong: strong.slice(0, n), weak: weak.slice(0, n) }
}

/** The potions, food, mounts and bags most often brought with a weapon, with their share. */
export function extrasOf(w: WeaponSummary | undefined, slot: ExtraSlot, n = 2): { name: string; icon: string; share: number }[] {
  const counts = w?.gear[slot] ?? []
  const total = counts.reduce((sum, [, c]) => sum + c, 0)
  return counts.flatMap(([base, c]) => {
    const item = extraItem(base)
    return item ? [{ ...item, share: c / total }] : []
  }).slice(0, n)
}

const AREA_LABELS: Record<string, string> = {
  OPEN_WORLD: 'Open world',
  HELLGATE: 'Hellgates',
  CORRUPTED_DUNGEON: 'Corrupted dungeons',
  CRYSTAL_LEAGUE: 'Crystal arena',
  ARENA: 'Arena',
  MISTS: 'Mists',
  UNKNOWN: 'Other',
}

export function areaLabel(area: string): string {
  return AREA_LABELS[area] ?? area.charAt(0) + area.slice(1).toLowerCase().replace(/_/g, ' ')
}

/** Where its fights happen, largest share first. */
export function areasOf(w: WeaponSummary | undefined): { area: string; share: number }[] {
  const entries = Object.entries(w?.areas ?? {}).map(([area, [a, b]]) => [area, a + b] as const)
  const total = entries.reduce((n, [, c]) => n + c, 0)
  return entries
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([area, c]) => ({ area, share: c / total }))
}
