import { describe, expect, it } from 'vitest'
import { getRecipe } from './recipes'
import { DEFAULT_SETTINGS } from './settings'
import { DEFAULT_FILTERS, evaluateAll, rankResults } from './rank'
import type { Price } from '../api/prices'
import type { PriceLookup } from './profit'
import { itemName } from '../api/items'
import type { SalesLookup } from '../api/history'

const NOW = new Date('2026-10-07T12:00:00Z').getTime()

function p(itemId: string, city: string, sellMin: number, hoursOld = 1): Price {
  const date = new Date(NOW - hoursOld * 3600_000)
  return { itemId, city, quality: 1, sellMin, sellMinDate: date, buyMax: sellMin - 5, buyMaxDate: date }
}

function lookup(list: Price[]): PriceLookup {
  const map = new Map(list.map((x) => [`${x.itemId}|${x.city}`, x]))
  return (id, city) => map.get(`${id}|${city}`)
}

const recipes = [getRecipe('ore', 4), getRecipe('hide', 4)]
const prices = lookup([
  p('T4_ORE', 'Thetford', 50),
  p('T3_METALBAR', 'Thetford', 40),
  p('T4_METALBAR', 'Thetford', 300),
  p('T4_ORE', 'Martlock', 50),
  p('T3_METALBAR', 'Martlock', 40),
  p('T4_METALBAR', 'Martlock', 200),
  p('T4_HIDE', 'Martlock', 50, 48), // stale
  p('T3_LEATHER', 'Martlock', 40),
  p('T4_LEATHER', 'Martlock', 400),
])

describe('evaluateAll and rankResults', () => {
  const all = evaluateAll(recipes, ['Thetford', 'Martlock'], prices, DEFAULT_SETTINGS)

  it('evaluates every recipe in every city', () => {
    expect(all).toHaveLength(4)
  })

  it('sorts by profit and hides incomplete and stale rows by default', () => {
    const ranked = rankResults(all, DEFAULT_FILTERS, NOW)
    expect(ranked.map((r) => `${r.recipe.output}@${r.refineCity}`)).toEqual([
      'T4_METALBAR@Thetford',
      'T4_METALBAR@Martlock',
    ])
  })

  it('shows stale and incomplete rows when asked, incomplete last', () => {
    const ranked = rankResults(all, { ...DEFAULT_FILTERS, hideIncomplete: false, maxAgeHours: null }, NOW)
    expect(ranked[0].recipe.output).toBe('T4_LEATHER')
    expect(ranked.at(-1)?.profit).toBeNull()
  })

  it('filters by resource and city', () => {
    const ranked = rankResults(all, { ...DEFAULT_FILTERS, resource: 'ore', city: 'Martlock' }, NOW)
    expect(ranked).toHaveLength(1)
    expect(ranked[0].refineCity).toBe('Martlock')
  })

  const sales: SalesLookup = (id, city) =>
    id === 'T4_METALBAR' && city === 'Martlock' ? { perDay: 300, avgPrice: 200 } : { perDay: 5, avgPrice: 300 }

  it('hides rows selling less than the minimum per day once sales have loaded', () => {
    const filters = { ...DEFAULT_FILTERS, minDailySales: 50 }
    expect(rankResults(all, filters, NOW, sales).map((r) => `${r.recipe.output}@${r.refineCity}`)).toEqual([
      'T4_METALBAR@Martlock',
    ])
    // Without sales data the filter is ignored rather than hiding everything.
    expect(rankResults(all, filters, NOW)).toHaveLength(2)
  })

  it('sorts by sales per day and by silver per focus', () => {
    expect(rankResults(all, { ...DEFAULT_FILTERS, sortBy: 'volume' }, NOW, sales)[0].refineCity).toBe('Martlock')
    const byFocus = rankResults(all, { ...DEFAULT_FILTERS, sortBy: 'focus' }, NOW)
    expect(byFocus[0].silverPerFocus!).toBeGreaterThanOrEqual(byFocus[1].silverPerFocus!)
    // A craft that loses money even with focus sinks below profitable ones.
    const losing = { ...byFocus[0], profitWithFocus: -1, silverPerFocus: 999 }
    expect(rankResults([losing, byFocus[1]], { ...DEFAULT_FILTERS, sortBy: 'focus' }, NOW)[0]).toBe(byFocus[1])
  })
})

describe('itemName', () => {
  it('turns ids into readable names', () => {
    expect(itemName('T5_METALBAR_LEVEL2@2')).toBe('T5.2 Metal bar')
    expect(itemName('T4_ROCK')).toBe('T4.0 Stone')
    expect(itemName('SOMETHING')).toBe('SOMETHING')
  })
})
