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

function row(base: string, price: number) {
  const weapon: Weapon = { base, name: base, sub: 'sword', twoHanded: false, variants: [] }
  return { weapon, price }
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
  const rows = [row('MAIN_SWORD', 50_000), row('MAIN_AXE', 100_000), row('2H_BOW', 40_000)]

  it('blends price and popularity 70/30 for the recommended order', () => {
    const ranked = rankWithMeta(rows, weaponMeta(summary, 's'), 'recommended')
    // Bow: cheapest, unused solo → 0.7. Sword: 0.8 as cheap, most popular → 0.86. Axe: 0.4 as cheap, half as popular → 0.43.
    expect(ranked.map((r) => r.weapon.base)).toEqual(['MAIN_SWORD', '2H_BOW', 'MAIN_AXE'])
    expect(ranked.map((r) => r.score)).toEqual([expect.closeTo(0.86), expect.closeTo(0.7), expect.closeTo(0.43)])
    expect(ranked[1].meta).toBeNull()
  })

  it('sorts by price or popularity', () => {
    const meta = weaponMeta(summary, 'all')
    expect(rankWithMeta(rows, meta, 'cheapest').map((r) => r.weapon.base)).toEqual(['2H_BOW', 'MAIN_SWORD', 'MAIN_AXE'])
    expect(rankWithMeta(rows, meta, 'popularity').map((r) => r.weapon.base)).toEqual(['MAIN_AXE', 'MAIN_SWORD', '2H_BOW'])
  })

  it('falls back to price without meta data', () => {
    expect(rankWithMeta(rows, null, 'recommended').map((r) => r.weapon.base)).toEqual(['2H_BOW', 'MAIN_SWORD', 'MAIN_AXE'])
  })
})
