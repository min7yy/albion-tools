import { filterStats, type FightSize, type MetaSummary } from '../meta/aggregate'

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
    const [k, d] = filterStats(stats, { size: fight })
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
