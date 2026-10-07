import { describe, expect, it } from 'vitest'
import type { MetaSummary } from '../meta/aggregate'
import { bestSet, cheapestSet, dearestSet, usualGear, type SetPiece } from './sets'
import type { WeaponOption } from './value'
import type { Weapon } from './weapons'

const sword: Weapon = { base: 'MAIN_SWORD', name: 'Broadsword', sub: 'sword', twoHanded: false, variants: [] }
const claymore: Weapon = { ...sword, base: '2H_CLAYMORE', name: 'Claymore', twoHanded: true }

function opt(itemPower: number, price: number): WeaponOption {
  return { itemId: `X${itemPower}`, tier: 4, ench: 0, quality: 1, itemPower, price, city: 'Martlock', date: new Date() }
}
function piece(slot: SetPiece['slot'], ...options: WeaponOption[]): SetPiece {
  return { slot, base: slot, name: slot, frontier: options }
}

describe('usualGear', () => {
  const summary: MetaSummary = {
    server: 'europe',
    updatedAt: '',
    from: '',
    to: '',
    events: 1,
    weapons: {
      '2H_CLAYMORE': {
        stats: {},
        gear: {
          OffHand: [['OFF_SHIELD', 9]],
          Head: [['NOT_A_REAL_ITEM', 9], ['HEAD_PLATE_SET1', 3]],
          Armor: [['ARMOR_PLATE_SET1', 5]],
        },
      },
    },
  }

  it('picks the most common known item per slot, with no off-hand for two-handed weapons', () => {
    expect(usualGear(claymore, summary).map((g) => [g.slot, g.base])).toEqual([
      ['Head', 'HEAD_PLATE_SET1'],
      ['Armor', 'ARMOR_PLATE_SET1'],
    ])
    expect(usualGear(sword, summary)).toEqual([])
  })
})

describe('bestSet', () => {
  const pieces = [
    piece('MainHand', opt(700, 1000), opt(800, 2000), opt(1100, 20_000)),
    piece('Head', opt(700, 500), opt(900, 1500)),
    piece('Armor', opt(700, 500), opt(800, 4000)),
    piece('Cape'),
  ]

  it('returns nothing when even the cheapest set is over budget', () => {
    expect(bestSet(sword, pieces, 1999)).toBeNull()
  })

  it('spends on the upgrades that add the most item power per silver', () => {
    // Start 2,000. Head +200 IP for 1,000 beats weapon +100 for 1,000 and armour +100 for 3,500.
    const set = bestSet(sword, pieces, 3000)
    expect(set?.picks.map((p) => p.option.itemPower)).toEqual([700, 900, 700])
    expect(set).toMatchObject({ price: 3000, itemPower: 767, missing: ['Cape'] })
    const more = bestSet(sword, pieces, 4000)
    expect(more?.picks.map((p) => p.option.itemPower)).toEqual([800, 900, 700])
  })

  it('counts a two-handed weapon twice', () => {
    const set = bestSet(claymore, pieces.slice(0, 3), 4000)
    // Weapon upgrade is worth 2 × 100 IP for 1,000, the same rate as the helmet, so both fit.
    expect(set?.picks.map((p) => p.option.itemPower)).toEqual([800, 900, 700])
    expect(set?.itemPower).toBe(Math.round((800 * 2 + 900 + 700) / 4))
  })

  it('gives the slider range', () => {
    expect(cheapestSet(pieces)).toBe(2000)
    expect(dearestSet(pieces)).toBe(25_500)
  })
})
