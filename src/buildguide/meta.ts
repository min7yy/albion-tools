import type { FightSize, MetaSummary } from '../meta/aggregate'
import type { BudgetRow } from './value'

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

export type SortMode = 'recommended' | 'itemPower' | 'popularity'

export const SORT_MODES: { id: SortMode; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'itemPower', label: 'Item power' },
  { id: 'popularity', label: 'Popularity' },
]

export interface MetaRow extends BudgetRow {
  meta: WeaponMeta | null
  /** 0–1: half how much item power the budget buys (against the best row), half how popular it is (against the most popular). */
  score: number
}

/** Adds meta data to budget rows and sorts them. */
export function rankWithMeta(rows: BudgetRow[], meta: Map<string, WeaponMeta> | null, sort: SortMode): MetaRow[] {
  const powers = rows.map((r) => r.best.itemPower)
  const minPower = Math.min(...powers)
  const maxPower = Math.max(...powers)
  let maxPopularity = 0
  for (const r of rows) maxPopularity = Math.max(maxPopularity, meta?.get(r.weapon.base)?.popularity ?? 0)

  const out: MetaRow[] = rows.map((r) => {
    const m = meta?.get(r.weapon.base) ?? null
    const power = maxPower > minPower ? (r.best.itemPower - minPower) / (maxPower - minPower) : 1
    const popularity = maxPopularity && m ? m.popularity / maxPopularity : 0
    return { ...r, meta: m, score: meta ? (power + popularity) / 2 : power }
  })
  const byPower = (a: MetaRow, b: MetaRow) => b.best.itemPower - a.best.itemPower || a.best.price - b.best.price
  if (sort === 'itemPower') return out.sort(byPower)
  if (sort === 'popularity') return out.sort((a, b) => (b.meta?.popularity ?? 0) - (a.meta?.popularity ?? 0) || byPower(a, b))
  return out.sort((a, b) => b.score - a.score || byPower(a, b))
}
