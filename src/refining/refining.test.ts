import { describe, expect, it } from 'vitest'
import { allRecipes, allRefiningItemIds, getRecipe } from './recipes'
import { DEFAULT_SETTINGS, focusCost, returnRate, stationFee } from './settings'
import { evaluateRefining, type PriceLookup } from './profit'
import type { Price } from '../api/prices'

describe('recipes', () => {
  it('builds flat and enchanted recipes', () => {
    expect(getRecipe('ore', 2).ingredients).toEqual([{ itemId: 'T2_ORE', count: 1 }])
    expect(getRecipe('hide', 5).ingredients).toEqual([
      { itemId: 'T5_HIDE', count: 3 },
      { itemId: 'T4_LEATHER', count: 1 },
    ])
    expect(getRecipe('wood', 6, 2)).toMatchObject({
      output: 'T6_PLANKS_LEVEL2@2',
      ingredients: [
        { itemId: 'T6_WOOD_LEVEL2@2', count: 4 },
        { itemId: 'T5_PLANKS_LEVEL2@2', count: 1 },
      ],
    })
  })

  it('uses flat T3 refined for enchanted T4', () => {
    expect(getRecipe('fiber', 4, 3).ingredients).toEqual([
      { itemId: 'T4_FIBER_LEVEL3@3', count: 2 },
      { itemId: 'T3_CLOTH', count: 1 },
    ])
  })

  it('stone is ROCK into STONEBLOCK', () => {
    expect(getRecipe('stone', 8).ingredients[0]).toEqual({ itemId: 'T8_ROCK', count: 5 })
  })

  it('covers every resource, tier and enchantment', () => {
    // Per resource: T2, T3 flat + T4–T8 × 5 enchantment levels = 27, but stone blocks are never enchanted.
    expect(allRecipes()).toHaveLength(4 * 27 + 7)
    expect(() => getRecipe('ore', 3, 1)).toThrow()
    expect(() => getRecipe('stone', 4, 1)).toThrow()
    expect(allRefiningItemIds()).toContain('T8_METALBAR_LEVEL4@4')
  })
})

describe('settings', () => {
  it('matches the known return rates', () => {
    expect(returnRate('ore', 'Martlock', false)).toBeCloseTo(0.1525, 3)
    expect(returnRate('ore', 'Thetford', false)).toBeCloseTo(0.367, 3)
    expect(returnRate('ore', 'Martlock', true)).toBeCloseTo(0.435, 3)
    expect(returnRate('ore', 'Thetford', true)).toBeCloseTo(0.539, 3)
    expect(returnRate('ore', 'Caerleon', false)).toBeCloseTo(0.1525, 3)
    expect(returnRate('ore', 'Black Market', false)).toBe(0)
  })

  it('computes station fee from item value', () => {
    // T4 flat: value 16 × 0.1125 = 1.8 nutrition, at 500 per 100 = 9 silver
    expect(stationFee(4, 0, 500)).toBeCloseTo(9)
    expect(stationFee(4, 1, 500)).toBeCloseTo(18)
  })
})

const price = (itemId: string, city: string, sellMin: number | null, buyMax: number | null): Price => ({
  itemId,
  city,
  quality: 1,
  sellMin,
  sellMinDate: sellMin ? new Date('2026-10-06T10:00:00Z') : null,
  buyMax,
  buyMaxDate: buyMax ? new Date('2026-10-06T09:00:00Z') : null,
})

function lookup(list: Price[]): PriceLookup {
  const map = new Map(list.map((p) => [`${p.itemId}|${p.city}`, p]))
  return (id, city) => map.get(`${id}|${city}`)
}

describe('evaluateRefining', () => {
  const recipe = getRecipe('ore', 5) // 3 × T5_ORE + 1 × T4_METALBAR → T5_METALBAR
  const prices = lookup([
    price('T5_ORE', 'Thetford', 100, 90),
    price('T4_METALBAR', 'Thetford', 200, 180),
    price('T5_METALBAR', 'Thetford', 800, 700),
  ])

  it('computes profit with returns, fees and tax', () => {
    const r = evaluateRefining({ recipe, prices, settings: DEFAULT_SETTINGS, refineCity: 'Thetford' })
    // Inputs 3×100 + 200 = 500, returns 36.7% → 316.46 net. Fee T5: 32×0.1125×3 = 10.8.
    expect(r.grossInputCost).toBe(500)
    expect(r.returnRate).toBeCloseTo(0.367, 3)
    expect(r.stationFee).toBeCloseTo(10.8)
    expect(r.buyFee).toBe(0)
    // Sell order at 800: 4% tax + 2.5% setup = 52
    expect(r.sellFees).toBe(52)
    expect(r.netRevenue).toBe(748)
    expect(r.totalCost).toBeCloseTo(316.46 + 10.8, 1)
    expect(r.profit).toBeCloseTo(748 - 327.26, 1)
    expect(r.missing).toEqual([])
    expect(r.oldestPriceDate?.toISOString()).toBe('2026-10-06T10:00:00.000Z')
  })

  it('switches prices and fees with buy and sell modes', () => {
    const r = evaluateRefining({
      recipe,
      prices,
      settings: { ...DEFAULT_SETTINGS, buyMode: 'order', sellMode: 'instant', premium: false, returnRateOverride: 0 },
      refineCity: 'Thetford',
    })
    expect(r.grossInputCost).toBe(3 * 90 + 180)
    expect(r.buyFee).toBeCloseTo(450 * 0.025)
    expect(r.sellPrice).toBe(700)
    expect(r.sellFees).toBeCloseTo(700 * 0.08)
  })

  it('reports missing prices instead of a profit', () => {
    const r = evaluateRefining({
      recipe,
      prices: lookup([price('T5_ORE', 'Martlock', 100, 90)]),
      settings: DEFAULT_SETTINGS,
      refineCity: 'Martlock',
    })
    expect(r.profit).toBeNull()
    expect(r.missing).toEqual(['T4_METALBAR', 'T5_METALBAR'])
  })

  it('can buy, refine and sell in different cities', () => {
    const r = evaluateRefining({
      recipe,
      prices: lookup([
        price('T5_ORE', 'Martlock', 100, 90),
        price('T4_METALBAR', 'Martlock', 200, 180),
        price('T5_METALBAR', 'Caerleon', 900, 850),
      ]),
      settings: DEFAULT_SETTINGS,
      buyCity: 'Martlock',
      refineCity: 'Thetford',
      sellCity: 'Caerleon',
    })
    expect(r.sellPrice).toBe(900)
    expect(r.returnRate).toBeCloseTo(0.367, 3)
    expect(r.profit).not.toBeNull()
  })
})

describe('focus', () => {
  it('uses the game focus cost table, where each enchant level costs one tier more', () => {
    expect(focusCost(2, 0)).toBe(18)
    expect(focusCost(4, 0)).toBe(54)
    expect(focusCost(5, 0)).toBe(94)
    expect(focusCost(4, 1)).toBe(94)
    expect(focusCost(8, 4)).toBe(4714)
    expect(focusCost(4, 0, 50)).toBe(27)
  })

  const recipe = getRecipe('ore', 5)
  const prices = lookup([
    price('T5_ORE', 'Thetford', 100, 90),
    price('T4_METALBAR', 'Thetford', 200, 180),
    price('T5_METALBAR', 'Thetford', 800, 700),
  ])

  it('reports the extra silver each focus point earns, whether or not focus is on', () => {
    const off = evaluateRefining({ recipe, prices, settings: DEFAULT_SETTINGS, refineCity: 'Thetford' })
    const on = evaluateRefining({ recipe, prices, settings: { ...DEFAULT_SETTINGS, useFocus: true }, refineCity: 'Thetford' })
    // Return rate goes from 36.7% to 53.9% on 500 silver of inputs, for 94 focus.
    const expected = (500 * (returnRate('ore', 'Thetford', true) - returnRate('ore', 'Thetford', false))) / 94
    expect(off.focusCost).toBe(94)
    expect(off.silverPerFocus).toBeCloseTo(expected)
    expect(on.silverPerFocus).toBeCloseTo(expected)
    expect(on.profit! - off.profit!).toBeCloseTo(expected * 94, 1)
  })

  it('has no silver per focus with a return rate override or a missing price', () => {
    const settings = { ...DEFAULT_SETTINGS, returnRateOverride: 0.3 }
    expect(evaluateRefining({ recipe, prices, settings, refineCity: 'Thetford' }).silverPerFocus).toBeNull()
    expect(
      evaluateRefining({ recipe, prices: lookup([]), settings: DEFAULT_SETTINGS, refineCity: 'Thetford' }).silverPerFocus,
    ).toBeNull()
  })
})
