import { describe, expect, it } from 'vitest'
import type { MetaSummary } from '../meta/aggregate'
import { loadoutsFor, rankBuilds, shrunkWinRate, type BuildRow } from './loadouts'
import type { TargetSet } from './target'
import type { Weapon } from './weapons'

const sword: Weapon = { base: 'MAIN_SWORD', name: 'Broadsword', sub: 'sword', twoHanded: false, variants: [] }
const claymore: Weapon = { ...sword, base: '2H_CLAYMORE', name: 'Claymore', twoHanded: true }
const plate = ['HEAD_PLATE_SET1', 'ARMOR_PLATE_SET1', 'SHOES_PLATE_SET1', 'CAPE']

const summary: MetaSummary = {
  server: 'asia',
  updatedAt: '',
  from: '',
  to: '',
  events: 100,
  weapons: {
    MAIN_SWORD: {
      stats: {},
      gear: {},
      builds: [
        [['OFF_SHIELD', ...plate], { s: [6, 4], l: [30, 30] }],
        [['', ...plate], { s: [20, 0] }],
        [['OFF_SHIELD', 'NOT_AN_ITEM', ...plate.slice(1)], { s: [50, 50] }],
        [['OFF_TORCH', ...plate], { s: [2, 1] }],
      ],
    },
    '2H_CLAYMORE': { stats: {}, gear: {}, builds: [[['', ...plate], { m: [9, 1] }]] },
  },
}

describe('loadoutsFor', () => {
  it('keeps complete loadouts with enough fights in the chosen fight size, most worn first', () => {
    const all = loadoutsFor(sword, summary, 'all')
    expect(all.map((l) => [l.gear.map((s) => s[0].base)[0], l.fights])).toEqual([['OFF_SHIELD', 70]])
    expect(loadoutsFor(sword, summary, 's').map((l) => l.fights)).toEqual([10])
    expect(loadoutsFor(sword, summary, 'm')).toEqual([])
  })

  it('has no off-hand slot for two-handed weapons', () => {
    const [l] = loadoutsFor(claymore, summary, 'all')
    expect(l.gear.map((s) => s[0].slot)).toEqual(['Head', 'Armor', 'Shoes', 'Cape'])
    expect(l).toMatchObject({ wins: 9, losses: 1 })
  })

  it('pulls small samples toward 50%', () => {
    expect(shrunkWinRate(9, 10)).toBeCloseTo(19 / 30)
    expect(shrunkWinRate(350, 500)).toBeGreaterThan(shrunkWinRate(9, 10))
  })
})

describe('rankBuilds', () => {
  const set = (price: number) => ({ price }) as TargetSet
  const loadout = (wins: number, fights: number) => ({ gear: [], wins, losses: fights - wins, fights, winRate: shrunkWinRate(wins, fights) })
  const rows: BuildRow[] = [
    { weapon: { ...sword, name: 'A' }, loadout: loadout(60, 100), set: set(300) },
    { weapon: { ...sword, name: 'B' }, loadout: loadout(400, 1000), set: set(200) },
    { weapon: { ...sword, name: 'C' }, loadout: null, set: set(100) },
  ]
  const names = (sort: Parameters<typeof rankBuilds>[1]) => rankBuilds(rows, sort).map((r) => r.weapon.name)

  it('sorts by each mode', () => {
    expect(names('winrate')).toEqual(['A', 'B', 'C'])
    expect(names('popularity')).toEqual(['B', 'A', 'C'])
    expect(names('cheapest')).toEqual(['C', 'B', 'A'])
  })

  it('weighs win rate, play and price for recommended', () => {
    // B: 0 win + 0.3 play + 0.15 price; A: 0.4 win + 0.03 play + 0.1 price; C: 0.3 price.
    expect(names('recommended')).toEqual(['A', 'B', 'C'])
  })
})
