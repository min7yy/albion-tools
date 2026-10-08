import { describe, expect, it } from 'vitest'
import type { MetaSummary, WeaponSummary } from '../meta/aggregate'
import { areaLabel, areasOf, extrasOf, matchupsOf, performanceOf, trendOf } from './insights'

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
  it('averages damage and healing per kill and fame per killing blow', () => {
    expect(performanceOf(weapon([], { perf: [3000, 600, 3, 90000, 2] }))).toEqual({ damage: 1000, healing: 200, killFame: 45000 })
    expect(performanceOf(weapon([]))).toBeNull()
  })

  it('lists the weapons it beats and loses to, ignoring tiny samples and unknown items', () => {
    const { strong, weak } = matchupsOf(
      weapon([], { matchups: [['2H_BOW', 10, 2], ['MAIN_FIRESTAFF', 1, 9], ['2H_CLAYMORE', 2, 0], ['NOT_A_WEAPON', 9, 0], ['MAIN_SWORD', 4, 3]] }),
    )
    expect(strong.map((m) => [m.opponent.name, m.wins, m.losses])).toEqual([['Bow', 10, 2], ['Broadsword', 4, 3]])
    expect(weak.map((m) => m.opponent.name)).toEqual(['Fire Staff'])
  })

  it('names the consumables brought with it', () => {
    const extras = extrasOf(weapon([], { gear: { Potion: [['POTION_HEAL', 3], ['POTION_NOPE', 1], ['POTION_REVIVE', 1]] } }), 'Potion')
    expect(extras).toEqual([
      { name: 'Major Healing Potion', icon: 'T6_POTION_HEAL', share: 0.6 },
      { name: 'Major Gigantify Potion', icon: 'T7_POTION_REVIVE', share: 0.2 },
    ])
  })

  it('splits fights by area', () => {
    expect(areasOf(weapon([], { areas: { OPEN_WORLD: [3, 3], HELLGATE: [1, 1] } }))).toEqual([
      { area: 'OPEN_WORLD', share: 0.75 },
      { area: 'HELLGATE', share: 0.25 },
    ])
    expect(areaLabel('CORRUPTED_DUNGEON')).toBe('Corrupted dungeons')
    expect(areaLabel('SOME_NEW_PLACE')).toBe('Some new place')
  })
})
