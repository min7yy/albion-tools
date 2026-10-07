import type { FightSize, MetaSummary } from '../meta/aggregate'
import type { Weapon } from './weapons'

export type FightFilter = 'all' | FightSize

export const FIGHT_FILTERS: { id: FightFilter; label: string }[] = [
  { id: 'all', label: 'All fights' },
  { id: 's', label: 'Solo' },
  { id: 'm', label: 'Small group (2–5)' },
  { id: 'l', label: 'Large (6+)' },
]

/** Published by .github/workflows/meta.yml. */
export function metaUrl(server: string): string {
  return `https://raw.githubusercontent.com/min7yy/albion-tools/meta-data/${server}.json`
}

export interface WeaponMeta {
  kills: number
  deaths: number
  /** Share of all weapon appearances in this fight size. */
  popularity: number
  /** kills / (kills + deaths). Group kills credit every attacker, so compare within one fight size. */
  killRatio: number
}

/** Kills, deaths and popularity per weapon for one fight size. */
export function weaponMeta(summary: MetaSummary, fight: FightFilter): Map<string, WeaponMeta> {
  const counts = new Map<string, [number, number]>()
  let total = 0
  for (const [weapon, { stats }] of Object.entries(summary.weapons)) {
    let k = 0
    let d = 0
    for (const [size, pair] of Object.entries(stats)) {
      if (fight !== 'all' && size !== fight) continue
      k += pair[0]
      d += pair[1]
    }
    if (k + d === 0) continue
    counts.set(weapon, [k, d])
    total += k + d
  }
  const out = new Map<string, WeaponMeta>()
  for (const [weapon, [kills, deaths]] of counts) {
    out.set(weapon, { kills, deaths, popularity: (kills + deaths) / total, killRatio: kills / (kills + deaths) })
  }
  return out
}

export type SortMode = 'recommended' | 'cheapest' | 'popularity'

export const SORT_MODES: { id: SortMode; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'cheapest', label: 'Cheapest' },
  { id: 'popularity', label: 'Popularity' },
]

/** Recommended: mostly how cheaply the target is reached, with popularity breaking near ties. */
export const PRICE_SHARE = 0.7

/** A set that reaches the target item power, built around a weapon. */
export interface Rankable {
  weapon: Weapon
  price: number
}

export type MetaRow<T extends Rankable> = T & {
  meta: WeaponMeta | null
  /** 0–1: 70% how cheap it is (against the cheapest row), 30% how popular (against the most popular). */
  score: number
}

/** Adds meta data to rows and sorts them. */
export function rankWithMeta<T extends Rankable>(rows: T[], meta: Map<string, WeaponMeta> | null, sort: SortMode): MetaRow<T>[] {
  const minPrice = Math.min(...rows.map((r) => r.price))
  let maxPopularity = 0
  for (const r of rows) maxPopularity = Math.max(maxPopularity, meta?.get(r.weapon.base)?.popularity ?? 0)

  const out: MetaRow<T>[] = rows.map((r) => {
    const m = meta?.get(r.weapon.base) ?? null
    const cheap = r.price > 0 ? minPrice / r.price : 1
    const popularity = maxPopularity && m ? m.popularity / maxPopularity : 0
    return { ...r, meta: m, score: meta ? PRICE_SHARE * cheap + (1 - PRICE_SHARE) * popularity : cheap }
  })
  const byPrice = (a: MetaRow<T>, b: MetaRow<T>) => a.price - b.price || a.weapon.name.localeCompare(b.weapon.name)
  if (sort === 'cheapest') return out.sort(byPrice)
  if (sort === 'popularity') return out.sort((a, b) => (b.meta?.popularity ?? 0) - (a.meta?.popularity ?? 0) || byPrice(a, b))
  return out.sort((a, b) => b.score - a.score || byPrice(a, b))
}
