import { describe, expect, it } from 'vitest'
import { CATEGORIES, CRAFT_RECIPES, INGREDIENT_NAMES } from './data'
import { BLACK_MARKET, craftingReturnRate, evaluateCrafting } from './evaluate'
import { DEFAULT_CRAFTING_FILTERS, craftingItemIds, evaluateAllCrafting, rankCrafting, recipesFor } from './rank'
import { DEFAULT_SETTINGS } from '../refining/settings'
import type { Price } from '../api/prices'
import type { PriceLookup } from '../profit'

const NOW = new Date('2026-10-07T12:00:00Z').getTime()

function p(itemId: string, city: string, sellMin: number | null, buyMax: number | null): Price {
  const date = new Date(NOW - 3600_000)
  return { itemId, city, quality: 1, sellMin, sellMinDate: sellMin ? date : null, buyMax, buyMaxDate: buyMax ? date : null }
}
function lookup(list: Price[]): PriceLookup {
  const map = new Map(list.map((x) => [`${x.itemId}|${x.city}`, x]))
  return (id, city) => map.get(`${id}|${city}`)
}
const recipe = (id: string) => {
  const r = CRAFT_RECIPES.find((x) => x.id === id)
  if (!r) throw new Error(`missing ${id}`)
  return r
}

describe('crafting data', () => {
  it('has the known broadsword and Kingmaker recipes', () => {
    expect(recipe('T4_MAIN_SWORD')).toMatchObject({
      name: 'Broadsword',
      category: 'weapons',
      sub: 'sword',
      itemValue: 384,
      resources: [
        ['T4_METALBAR', 16],
        ['T4_LEATHER', 8],
      ],
    })
    expect(recipe('T6_2H_CLAYMORE_AVALON@2').resources).toEqual([
      ['T6_METALBAR_LEVEL2@2', 20],
      ['T6_LEATHER_LEVEL2@2', 12],
      ['T6_ARTEFACT_2H_CLAYMORE_AVALON', 1, 1],
    ])
    expect(INGREDIENT_NAMES['T6_ARTEFACT_2H_CLAYMORE_AVALON']).toBe("Master's Remnants of the Old King")
  })

  it('groups recipes into categories with sub-categories', () => {
    const weapons = CATEGORIES.find((c) => c.id === 'weapons')
    expect(weapons?.subs).toContain('sword')
    expect(recipesFor(CRAFT_RECIPES, { category: 'weapons', sub: 'sword' }).every((r) => r.sub === 'sword')).toBe(true)
  })
})

describe('evaluateCrafting', () => {
  const sword = recipe('T4_MAIN_SWORD')
  const prices = lookup([
    p('T4_METALBAR', 'Lymhurst', 100, 90),
    p('T4_LEATHER', 'Lymhurst', 120, 110),
    p('T4_MAIN_SWORD', 'Lymhurst', 4000, 3500),
    p('T4_MAIN_SWORD', BLACK_MARKET, null, 4200),
  ])

  it('prices a craft with returns, station fee and tax', () => {
    const r = evaluateCrafting(sword, 'Lymhurst', 'Lymhurst', prices, DEFAULT_SETTINGS)
    expect(r.grossInputCost).toBe(16 * 100 + 8 * 120)
    expect(r.returnRate).toBeCloseTo(craftingReturnRate('Lymhurst', false))
    expect(r.stationFee).toBeCloseTo(384 * 0.1125 * 3)
    expect(r.sellPrice).toBe(4000)
    expect(r.profit).not.toBeNull()
  })

  it('always sells instantly to the Black Market', () => {
    const r = evaluateCrafting(sword, 'Lymhurst', BLACK_MARKET, prices, DEFAULT_SETTINGS)
    expect(r.sellPrice).toBe(4200)
    expect(r.sellFees).toBeCloseTo(4200 * 0.04)
  })

  it('does not return artifacts', () => {
    const king = recipe('T6_2H_CLAYMORE_AVALON')
    const r = evaluateCrafting(
      king,
      'Martlock',
      'Martlock',
      lookup([
        p('T6_METALBAR', 'Martlock', 100, 90),
        p('T6_LEATHER', 'Martlock', 100, 90),
        p('T6_ARTEFACT_2H_CLAYMORE_AVALON', 'Martlock', 10000, 9000),
        p('T6_2H_CLAYMORE_AVALON', 'Martlock', 20000, 18000),
      ]),
      { ...DEFAULT_SETTINGS, returnRateOverride: 0.5 },
    )
    expect(r.returnedValue).toBe((20 * 100 + 12 * 100) * 0.5)
  })
})

describe('rankCrafting', () => {
  it('ranks by profit across cities and sell locations', () => {
    const recipes = [recipe('T4_MAIN_SWORD')]
    const prices = lookup([
      p('T4_METALBAR', 'Lymhurst', 100, 90),
      p('T4_LEATHER', 'Lymhurst', 120, 110),
      p('T4_METALBAR', 'Martlock', 150, 140),
      p('T4_LEATHER', 'Martlock', 150, 140),
      p('T4_MAIN_SWORD', BLACK_MARKET, null, 5000),
    ])
    const all = evaluateAllCrafting(recipes, ['Lymhurst', 'Martlock'], BLACK_MARKET, prices, DEFAULT_SETTINGS)
    const ranked = rankCrafting(all, DEFAULT_CRAFTING_FILTERS, NOW)
    expect(ranked.map((r) => r.craftCity)).toEqual(['Lymhurst', 'Martlock'])
    expect(craftingItemIds(recipes)).toEqual(['T4_MAIN_SWORD', 'T4_METALBAR', 'T4_LEATHER'])
  })
})
