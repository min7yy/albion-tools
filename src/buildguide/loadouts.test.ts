import { describe, expect, it } from 'vitest'
import { filterStats, statKey, type MetaSummary } from '../meta/aggregate'
import { alternatives, buildsFor, rankBuilds, shrunkWinRate, statsFilter, type BuildRow } from './loadouts'
import type { Weapon } from './weapons'

const sword: Weapon = { base: 'MAIN_SWORD', name: 'Broadsword', sub: 'sword', twoHanded: false, variants: [] }
const claymore: Weapon = { ...sword, base: '2H_CLAYMORE', name: 'Claymore', twoHanded: true }
const bow: Weapon = { ...sword, base: '2H_BOW', name: 'Bow', twoHanded: true }
const plate = ['HEAD_PLATE_SET1', 'ARMOR_PLATE_SET1', 'SHOES_PLATE_SET1', 'CAPE']

const summary: MetaSummary = {
  server: 'asia',
  updatedAt: '',
  from: '',
  to: '',
  events: 100,
  weapons: {
    MAIN_SWORD: {
      stats: { s1100: [40, 30] },
      gear: { Head: [['HEAD_PLATE_SET1', 3], ['HEAD_LEATHER_SET1', 1], ['UNIQUE_HEAD_X', 1]] },
      builds: [
        [['OFF_SHIELD', ...plate], { s1000: [6, 4], l1200: [30, 30] }],
        [['', ...plate], { s: [20, 0] }],
        [['OFF_SHIELD', 'NOT_AN_ITEM', ...plate.slice(1)], { s1100: [50, 50] }],
        [['OFF_TORCH', ...plate], { s1100: [2, 1] }],
      ],
    },
    '2H_CLAYMORE': { stats: {}, gear: {}, builds: [[['', ...plate], { m1100: [9, 1] }]] },
    '2H_BOW': {
      stats: { m1300: [3, 2], s: [1, 0] },
      gear: { Head: [['HEAD_LEATHER_SET1', 5]], Armor: [['ARMOR_LEATHER_SET1', 5]], Shoes: [['SHOES_LEATHER_SET1', 5]], Cape: [['CAPE', 5]] },
      builds: [],
    },
  },
}

describe('stats keys', () => {
  it('records fight size and item power step, and filters on both', () => {
    expect(statKey('s', 1188)).toBe('s1100')
    expect(statKey('l')).toBe('l')
    const stats = { s1000: [1, 2] as [number, number], s1100: [3, 4] as [number, number], l1100: [5, 6] as [number, number], s: [7, 8] as [number, number] }
    expect(filterStats(stats)).toEqual([16, 20])
    expect(filterStats(stats, { size: 's' })).toEqual([11, 14])
    expect(filterStats(stats, { itemPower: { from: 1100, to: 1200 } })).toEqual([8, 10])
  })
})

describe('buildsFor', () => {
  it('keeps complete loadouts with enough fights, most worn first, with their item power', () => {
    const all = buildsFor(sword, summary, statsFilter('all', null))
    expect(all.map((b) => [b.gear[0].base, b.fights, b.itemPower])).toEqual([['OFF_SHIELD', 70, 1221]])
    expect(buildsFor(sword, summary, statsFilter('s', null)).map((b) => b.fights)).toEqual([10])
  })

  it('filters to fights near an item power', () => {
    // 1200 ± 100 keeps the 1100 and 1200 steps: the large fights only.
    const [b] = buildsFor(sword, summary, statsFilter('all', 1200))
    expect(b).toMatchObject({ fights: 60, bySize: { s: [0, 0], m: [0, 0], l: [30, 30] } })
  })

  it('has no off-hand slot for two-handed weapons', () => {
    const [b] = buildsFor(claymore, summary, statsFilter('all', null))
    expect(b.gear.map((g) => g.slot)).toEqual(['Head', 'Armor', 'Shoes', 'Cape'])
    expect(b).toMatchObject({ wins: 9, losses: 1, usual: false })
  })

  it("falls back to the weapon's usual gear and record when no loadout has enough fights", () => {
    const [b] = buildsFor(bow, summary, statsFilter('all', null))
    expect(b).toMatchObject({ usual: true, fights: 6, itemPower: 1350 })
    expect(b.gear.map((g) => g.base)).toEqual(['HEAD_LEATHER_SET1', 'ARMOR_LEATHER_SET1', 'SHOES_LEATHER_SET1', 'CAPE'])
    expect(buildsFor(bow, summary, statsFilter('l', null))).toEqual([])
  })

  it('pulls small samples toward 50%', () => {
    expect(shrunkWinRate(9, 10)).toBeCloseTo(19 / 30)
    expect(shrunkWinRate(350, 500)).toBeGreaterThan(shrunkWinRate(9, 10))
  })

  it('lists other items worn in a slot with their share', () => {
    expect(alternatives(sword, summary, 'Head').map((a) => [a.item.base, a.share])).toEqual([
      ['HEAD_PLATE_SET1', 0.6],
      ['HEAD_LEATHER_SET1', 0.2],
    ])
  })
})

describe('rankBuilds', () => {
  const row = (name: string, wins: number, fights: number): BuildRow => ({
    weapon: { ...sword, name },
    gear: [],
    wins,
    losses: fights - wins,
    fights,
    winRate: shrunkWinRate(wins, fights),
    itemPower: null,
    bySize: { s: [0, 0], m: [0, 0], l: [0, 0] },
    usual: false,
  })
  const rows = [row('A', 70, 100), row('B', 500, 1000), row('C', 5, 20)]
  const names = (sort: Parameters<typeof rankBuilds>[1]) => rankBuilds(rows, sort).map((r) => r.weapon.name)

  it('sorts by win rate, play or both', () => {
    expect(names('winrate')).toEqual(['A', 'B', 'C'])
    expect(names('popularity')).toEqual(['B', 'A', 'C'])
    // B's 1,000 fights at 50% edge out A's 100 at 70%.
    expect(names('recommended')).toEqual(['B', 'A', 'C'])
  })
})
