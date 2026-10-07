import { describe, expect, it } from 'vitest'
import type { Price } from '../api/prices'
import {
  bestUnderBudget,
  budgetRange,
  cheapestOffer,
  evaluateWeapons,
  indexQualityPrices,
  rankForBudget,
  valueFrontier,
  weaponOptions,
  type OfferSettings,
} from './value'
import { WEAPONS, weaponItemId, weaponItemIds, type Weapon } from './weapons'

const NOW = new Date('2026-10-07T12:00:00Z').getTime()
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000)

function p(itemId: string, city: string, sellMin: number, quality = 1, date = hoursAgo(1)): Price {
  return { itemId, city, quality, sellMin, sellMinDate: date, buyMax: null, buyMaxDate: null }
}

const settings: OfferSettings = { cities: ['Martlock', 'Lymhurst'], maxAgeHours: 48, now: NOW }

const sword: Weapon = {
  base: 'MAIN_SWORD',
  name: 'Broadsword',
  sub: 'sword',
  twoHanded: false,
  variants: [
    [4, 4, 1100],
    [7, 1, 1100],
    [8, 0, 1100],
    [6, 0, 900],
  ],
}

describe('weapon data', () => {
  it('builds market ids with the enchantment suffix', () => {
    expect(weaponItemId('MAIN_SWORD', 4, 0)).toBe('T4_MAIN_SWORD')
    expect(weaponItemId('2H_CLAYMORE_AVALON', 6, 2)).toBe('T6_2H_CLAYMORE_AVALON@2')
    expect(weaponItemIds([sword])).toContain('T7_MAIN_SWORD@1')
  })

  it('ships item power for every weapon type', () => {
    const broadsword = WEAPONS.find((w) => w.base === 'MAIN_SWORD')
    expect(broadsword?.name).toBe('Broadsword')
    // A 4.4 has the same item power as a 7.1 and an 8.0.
    const ip = (t: number, e: number) => broadsword?.variants.find(([tier, ench]) => tier === t && ench === e)?.[2]
    expect(ip(4, 4)).toBe(ip(7, 1))
    expect(ip(8, 0)).toBe(ip(7, 1))
    expect(new Set(WEAPONS.map((w) => w.sub))).toContain('shapeshifterstaff')
  })
})

describe('cheapestOffer', () => {
  it('picks the cheapest city and skips stale orders', () => {
    const prices = indexQualityPrices([
      p('T4_MAIN_SWORD@4', 'Martlock', 900),
      p('T4_MAIN_SWORD@4', 'Lymhurst', 500, 1, hoursAgo(72)),
    ])
    expect(cheapestOffer('T4_MAIN_SWORD@4', 1, prices, settings)).toMatchObject({ price: 900, city: 'Martlock' })
    expect(cheapestOffer('T4_MAIN_SWORD@4', 1, prices, { ...settings, maxAgeHours: 96 })).toMatchObject({ price: 500, city: 'Lymhurst' })
  })

  it('only looks in the chosen cities', () => {
    const prices = indexQualityPrices([p('T4_MAIN_SWORD@4', 'Caerleon', 100)])
    expect(cheapestOffer('T4_MAIN_SWORD@4', 1, prices, settings)).toBeNull()
  })
})

describe('weaponOptions and valueFrontier', () => {
  const prices = indexQualityPrices([
    p('T4_MAIN_SWORD@4', 'Martlock', 100_000),
    p('T7_MAIN_SWORD@1', 'Lymhurst', 140_000),
    p('T8_MAIN_SWORD', 'Martlock', 90_000),
    p('T8_MAIN_SWORD', 'Martlock', 95_000, 3),
    p('T6_MAIN_SWORD', 'Martlock', 20_000),
    p('T6_MAIN_SWORD', 'Lymhurst', 30_000, 5),
  ])
  const options = weaponOptions(sword, prices, settings)

  it('adds item power for quality', () => {
    expect(options.find((o) => o.itemId === 'T8_MAIN_SWORD' && o.quality === 3)?.itemPower).toBe(1140)
    expect(options.find((o) => o.itemId === 'T6_MAIN_SWORD' && o.quality === 5)?.itemPower).toBe(1000)
  })

  it('keeps only versions that add item power for the extra silver', () => {
    const frontier = valueFrontier(options).map((o) => [o.itemId, o.quality, o.price])
    expect(frontier).toEqual([
      ['T6_MAIN_SWORD', 1, 20_000],
      ['T6_MAIN_SWORD', 5, 30_000],
      ['T8_MAIN_SWORD', 1, 90_000],
      ['T8_MAIN_SWORD', 3, 95_000],
    ])
  })

  it('picks the most item power under the budget', () => {
    const frontier = valueFrontier(options)
    expect(bestUnderBudget(frontier, 10_000)).toBeNull()
    expect(bestUnderBudget(frontier, 50_000)).toMatchObject({ itemId: 'T6_MAIN_SWORD', quality: 5 })
    expect(bestUnderBudget(frontier, 1_000_000)).toMatchObject({ itemId: 'T8_MAIN_SWORD', quality: 3 })
  })
})

describe('rankForBudget', () => {
  const axe: Weapon = { base: 'MAIN_AXE', name: 'Battleaxe', sub: 'axe', twoHanded: false, variants: [[5, 0, 800], [6, 0, 900]] }
  const bow: Weapon = { base: '2H_BOW', name: 'Bow', sub: 'bow', twoHanded: true, variants: [[6, 0, 900]] }
  const prices = indexQualityPrices([
    p('T6_MAIN_SWORD', 'Martlock', 20_000),
    p('T5_MAIN_AXE', 'Martlock', 5_000),
    p('T6_MAIN_AXE', 'Martlock', 15_000),
  ])
  const values = evaluateWeapons([sword, axe, bow], prices, settings)

  it('drops weapons with no prices', () => {
    expect(values.map((v) => v.weapon.base)).toEqual(['MAIN_SWORD', 'MAIN_AXE'])
  })

  it('ranks by item power, then price, and drops weapons over budget', () => {
    expect(rankForBudget(values, 25_000).map((r) => [r.weapon.base, r.best.itemId])).toEqual([
      ['MAIN_AXE', 'T6_MAIN_AXE'],
      ['MAIN_SWORD', 'T6_MAIN_SWORD'],
    ])
    expect(rankForBudget(values, 10_000).map((r) => r.best.itemId)).toEqual(['T5_MAIN_AXE'])
  })

  it('gives the slider range', () => {
    expect(budgetRange(values)).toEqual({ min: 5_000, max: 20_000 })
    expect(budgetRange([])).toBeNull()
  })
})
