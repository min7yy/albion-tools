import type { ExtraSlot, MetaSummary, WeaponSummary } from '../meta/aggregate'
import type { CommunityPicks } from '../meta/community'
import { extraItem } from './spells'

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

/** The potions, food, mounts and bags most often brought with a weapon, with their share. */
export function extrasOf(w: WeaponSummary | undefined, slot: ExtraSlot, n = 2): { name: string; icon: string; share: number }[] {
  const counts = w?.gear[slot] ?? []
  const total = counts.reduce((sum, [, c]) => sum + c, 0)
  return counts.flatMap(([base, c]) => {
    const item = extraItem(base)
    return item ? [{ ...item, share: c / total }] : []
  }).slice(0, n)
}

/** The potion or food most picked in community builds with this weapon, with its share of them. */
export function communityConsumable(
  weapon: string,
  community: CommunityPicks | null,
  slot: 'Potion' | 'Food',
): { name: string; icon: string; share: number; builds: number } | null {
  const c = community?.consumables?.[weapon]
  if (!c?.builds) return null
  const [base, n] = Object.entries(c[slot]).sort((a, b) => b[1] - a[1])[0] ?? []
  const item = base ? extraItem(base) : null
  return item && n ? { ...item, share: n / c.builds, builds: c.builds } : null
}
