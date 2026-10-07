import { describe, expect, it } from 'vitest'
import type { MetaSummary } from '../meta/aggregate'
import { weaponMeta } from './meta'

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
