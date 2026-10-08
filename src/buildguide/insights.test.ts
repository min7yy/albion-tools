import { describe, expect, it } from 'vitest'
import type { MetaSummary, WeaponSummary } from '../meta/aggregate'
import { communityConsumable, extrasOf, trendOf } from './insights'

const weapon = (trend: [number, number][], extra: Partial<WeaponSummary> = {}): WeaponSummary => ({ stats: {}, gear: {}, trend, ...extra })

describe('trendOf', () => {
  const dates = ['d1', 'd2', 'd3', 'd4', 'd5']
  const flat: [number, number][] = [[50, 50], [50, 50], [50, 50], [50, 50], [50, 50]]
  it('flags a weapon whose share of fights has grown lately', () => {
    const summary: MetaSummary = {
      server: 'asia', updatedAt: '', from: '', to: '', events: 0, dates,
      weapons: {
        A: weapon([[5, 5], [5, 5], [5, 5], [15, 15], [15, 15]]),
        B: weapon(flat),
        C: weapon([[10, 10], [10, 10], [10, 10], [10, 10], [10, 10]]),
        D: weapon([[30, 30], [30, 30], [30, 30], [5, 5], [5, 5]]),
      },
    }
    expect(trendOf('A', summary)?.dir).toBe('up')
    expect(trendOf('D', summary)?.dir).toBe('down')
    // Same fights every day, but everyone else dropped off: a share change under 1.3× isn't a trend.
    expect(trendOf('B', summary)).toBeNull()
    expect(trendOf('C', summary)).toBeNull()
  })
  it('needs enough fights and days', () => {
    const summary: MetaSummary = {
      server: 'asia', updatedAt: '', from: '', to: '', events: 0, dates,
      weapons: { A: weapon([[0, 0], [0, 0], [0, 0], [5, 5], [5, 5]]), B: weapon(flat) },
    }
    expect(trendOf('A', summary)).toBeNull()
    expect(trendOf('B', { ...summary, dates: ['d1', 'd2'] })).toBeNull()
    expect(trendOf('B', { ...summary, dates: undefined })).toBeNull()
  })
})

describe('weapon insights', () => {
  it('names the consumables brought with it', () => {
    const extras = extrasOf(weapon([], { gear: { Potion: [['POTION_HEAL', 3], ['POTION_NOPE', 1], ['POTION_REVIVE', 1]] } }), 'Potion')
    expect(extras).toEqual([
      { name: 'Major Healing Potion', icon: 'T6_POTION_HEAL', share: 0.6 },
      { name: 'Major Gigantify Potion', icon: 'T7_POTION_REVIVE', share: 0.2 },
    ])
  })

})

describe('communityConsumable', () => {
  it('picks the potion or food most used in community builds with the weapon', () => {
    const community = {
      updatedAt: '',
      builds: 4,
      items: {},
      consumables: { '2H_BOW': { builds: 4, Potion: { POTION_HEAL: 1, POTION_REVIVE: 3 }, Food: {} } },
    }
    expect(communityConsumable('2H_BOW', community, 'Potion')).toEqual({ name: 'Major Gigantify Potion', icon: 'T7_POTION_REVIVE', share: 0.75, builds: 4 })
    expect(communityConsumable('2H_BOW', community, 'Food')).toBeNull()
    expect(communityConsumable('MAIN_SWORD', community, 'Potion')).toBeNull()
    expect(communityConsumable('2H_BOW', null, 'Potion')).toBeNull()
  })
})
