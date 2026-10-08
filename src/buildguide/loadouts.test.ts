import { describe, expect, it } from 'vitest'
import { filterStats, statKey, type MetaSummary } from '../meta/aggregate'
import { alternatives, rankBuilds, shrunkWinRate, weaponRow } from './loadouts'
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

describe('weaponRow', () => {
  it("gives the weapon's record and its best loadout with enough fights", () => {
    const r = weaponRow(sword, summary, 'all')!
    expect(r).toMatchObject({ wins: 40, losses: 30, fights: 70 })
    // The shield set is the only complete loadout with 8+ fights.
    expect(r.best).toMatchObject({ fights: 70, usual: false, itemPower: 1221 })
    expect(r.best!.gear[0].base).toBe('OFF_SHIELD')
  })

  it('picks the best set in each item power bracket', () => {
    const r = weaponRow(sword, summary, 'all')!
    const by = Object.fromEntries(r.brackets.map((b) => [b.bracket.label, b]))
    // Under 1000 has no recorded fights; 1000–1199 has the shield set's 10 small fights.
    expect(by['Under 1000'].set).toBeNull()
    expect(by['1000–1199'].set).toMatchObject({ fights: 10, wins: 6 })
    expect(by['1200–1399'].set).toMatchObject({ fights: 60 })
    expect(by['1000–1199']).toMatchObject({ wins: 40, losses: 30 })
  })

  it('prefers the better win rate over the more worn set', () => {
    const s: MetaSummary = {
      ...summary,
      weapons: {
        MAIN_SWORD: {
          stats: { s1100: [80, 60] },
          gear: {},
          builds: [
            [['OFF_SHIELD', ...plate], { s1100: [50, 50] }],
            [['OFF_TORCH', ...plate], { s1100: [30, 10] }],
          ],
        },
      },
    }
    expect(weaponRow(sword, s, 'all')!.best!.gear[0].base).toBe('OFF_TORCH')
  })

  it('has no off-hand slot for two-handed weapons', () => {
    expect(weaponRow(claymore, summary, 'all')).toBeNull()
    const s: MetaSummary = { ...summary, weapons: { ...summary.weapons, '2H_CLAYMORE': { ...summary.weapons['2H_CLAYMORE'], stats: { m1100: [9, 1] } } } }
    const r = weaponRow(claymore, s, 'all')!
    expect(r.best!.gear.map((g) => g.slot)).toEqual(['Head', 'Armor', 'Shoes', 'Cape'])
    expect(r.best).toMatchObject({ wins: 9, losses: 1, usual: false })
  })

  it("falls back to the weapon's usual gear and record when no loadout has enough fights", () => {
    const r = weaponRow(bow, summary, 'all')!
    expect(r.best).toMatchObject({ usual: true, fights: 6, itemPower: 1350 })
    expect(r.best!.gear.map((g) => g.base)).toEqual(['HEAD_LEATHER_SET1', 'ARMOR_LEATHER_SET1', 'SHOES_LEATHER_SET1', 'CAPE'])
    expect(weaponRow(bow, summary, 'l')).toBeNull()
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
  const row = (name: string, wins: number, fights: number) => ({
    weapon: { ...sword, name },
    fights,
    winRate: shrunkWinRate(wins, fights),
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
