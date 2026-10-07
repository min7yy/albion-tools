import { describe, expect, it } from 'vitest'
import type { MetaSummary } from '../meta/aggregate'
import { rankWithMeta, weaponMeta } from './meta'
import type { Weapon } from './weapons'

const summary: MetaSummary = {
  server: 'europe',
  updatedAt: '2026-10-07T09:00:00Z',
  from: '2026-10-01',
  to: '2026-10-07',
  events: 100,
  weapons: {
    MAIN_SWORD: { stats: { s: [30, 10], m: [5, 5] }, gear: {} },
    MAIN_AXE: { stats: { s: [5, 15], l: [40, 0] }, gear: {} },
    '2H_BOW': { stats: { m: [10, 0] }, gear: {} },
  },
}

function row(base: string, itemPower: number, price: number) {
  const weapon: Weapon = { base, name: base, sub: 'sword', twoHanded: false, variants: [] }
  return { weapon, itemPower, price }
}

describe('weaponMeta', () => {
  it('sums every fight size for all fights', () => {
    const m = weaponMeta(summary, 'all')
    expect(m.get('MAIN_SWORD')).toEqual({ kills: 35, deaths: 15, popularity: 50 / 120, killRatio: 0.7 })
    expect(m.get('MAIN_AXE')?.popularity).toBeCloseTo(60 / 120)
  })

  it('only counts the chosen fight size', () => {
    const solo = weaponMeta(summary, 's')
    expect([...solo.keys()]).toEqual(['MAIN_SWORD', 'MAIN_AXE'])
    expect(solo.get('MAIN_AXE')).toMatchObject({ kills: 5, deaths: 15, popularity: 20 / 60, killRatio: 0.25 })
  })
})

describe('rankWithMeta', () => {
  const rows = [row('MAIN_SWORD', 1000, 50_000), row('MAIN_AXE', 900, 40_000), row('2H_BOW', 1100, 90_000)]

  it('blends item power and popularity for the recommended order', () => {
    const ranked = rankWithMeta(rows, weaponMeta(summary, 's'), 'recommended')
    // Sword: power 0.5, popularity 1 → 0.75. Bow: power 1, unused solo → 0.5. Axe: power 0, popularity 0.5 → 0.25.
    expect(ranked.map((r) => [r.weapon.base, r.score])).toEqual([
      ['MAIN_SWORD', 0.75],
      ['2H_BOW', 0.5],
      ['MAIN_AXE', 0.25],
    ])
    expect(ranked[1].meta).toBeNull()
  })

  it('sorts by item power or popularity', () => {
    const meta = weaponMeta(summary, 'all')
    expect(rankWithMeta(rows, meta, 'itemPower').map((r) => r.weapon.base)).toEqual(['2H_BOW', 'MAIN_SWORD', 'MAIN_AXE'])
    expect(rankWithMeta(rows, meta, 'popularity').map((r) => r.weapon.base)).toEqual(['MAIN_AXE', 'MAIN_SWORD', '2H_BOW'])
  })

  it('falls back to item power without meta data', () => {
    expect(rankWithMeta(rows, null, 'recommended').map((r) => r.weapon.base)).toEqual(['2H_BOW', 'MAIN_SWORD', 'MAIN_AXE'])
  })
})
