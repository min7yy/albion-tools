import { describe, expect, it } from 'vitest'
import { BLACK_MARKET, DEFAULT_FLIP_FILTERS, flipVolume, flipsForItem, rankFlips } from './flips'
import type { SalesLookup } from '../api/history'
import { RESOURCE_ITEMS, flipItemsFor } from './items'
import { flipMarketsFor } from './markets'
import type { Price } from '../api/prices'
import type { PriceLookup, TradeSettings } from '../profit'

const NOW = new Date('2026-10-07T12:00:00Z').getTime()
const recent = new Date(NOW - 3600_000)

function p(itemId: string, city: string, sellMin: number | null, buyMax: number | null, date = recent): Price {
  return { itemId, city, quality: 1, sellMin, sellMinDate: sellMin ? date : null, buyMax, buyMaxDate: buyMax ? date : null }
}
function lookup(list: Price[]): PriceLookup {
  const map = new Map(list.map((x) => [`${x.itemId}|${x.city}`, x]))
  return (id, city) => map.get(`${id}|${city}`)
}

const instantBuyOrderSell: TradeSettings = { premium: true, buyMode: 'instant', sellMode: 'order' }
const markets = ['Martlock', 'Lymhurst', BLACK_MARKET]
const prices = lookup([
  p('T4_BAG', 'Martlock', 1000, 900),
  p('T4_BAG', 'Lymhurst', 1500, 1300),
  p('T4_BAG', BLACK_MARKET, null, 1800),
])

describe('flipsForItem', () => {
  it('prices every route with tax and setup fees', () => {
    const flips = flipsForItem('T4_BAG', markets, prices, instantBuyOrderSell)
    const toLym = flips.find((f) => f.buyMarket === 'Martlock' && f.sellMarket === 'Lymhurst')
    // Sell order at 1500: 4% tax + 2.5% setup = 97.5
    expect(toLym).toMatchObject({ buyPrice: 1000, sellPrice: 1500, fees: 97.5, profit: 402.5 })
  })

  it('never buys from the Black Market and always sells to it instantly', () => {
    const flips = flipsForItem('T4_BAG', markets, prices, instantBuyOrderSell)
    expect(flips.some((f) => f.buyMarket === BLACK_MARKET)).toBe(false)
    const toBm = flips.find((f) => f.buyMarket === 'Martlock' && f.sellMarket === BLACK_MARKET)
    expect(toBm).toMatchObject({ sellPrice: 1800, fees: 72, profit: 728 })
  })

  it('adds the buy order fee when buying with orders', () => {
    const flips = flipsForItem('T4_BAG', markets, prices, { ...instantBuyOrderSell, buyMode: 'order' })
    const toBm = flips.find((f) => f.buyMarket === 'Martlock' && f.sellMarket === BLACK_MARKET)
    expect(toBm?.buyPrice).toBe(900)
    expect(toBm?.fees).toBeCloseTo(900 * 0.025 + 1800 * 0.04)
  })
})

describe('rankFlips', () => {
  const flips = flipsForItem('T4_BAG', markets, prices, instantBuyOrderSell)

  it('keeps only the best route per item by default', () => {
    const ranked = rankFlips(flips, DEFAULT_FLIP_FILTERS, NOW)
    expect(ranked).toHaveLength(1)
    expect(ranked[0].sellMarket).toBe(BLACK_MARKET)
  })

  it('shows every profitable route when asked and drops losers', () => {
    const ranked = rankFlips(flips, { ...DEFAULT_FLIP_FILTERS, bestRouteOnly: false }, NOW)
    expect(ranked.map((f) => `${f.buyMarket}>${f.sellMarket}`)).toEqual([
      'Martlock>Black Market',
      'Martlock>Lymhurst',
      'Lymhurst>Black Market',
    ])
    expect(ranked.every((f) => f.profit > 0)).toBe(true)
    expect(ranked.some((f) => f.buyMarket === 'Lymhurst' && f.sellMarket === 'Martlock')).toBe(false)
  })

  it('hides stale prices', () => {
    const old = lookup([p('T4_BAG', 'Martlock', 1000, 900, new Date(NOW - 48 * 3600_000)), p('T4_BAG', BLACK_MARKET, null, 1800)])
    expect(rankFlips(flipsForItem('T4_BAG', markets, old, instantBuyOrderSell), DEFAULT_FLIP_FILTERS, NOW)).toEqual([])
  })

  // Bags barely sell on the Black Market but move in Lymhurst.
  const sales: SalesLookup = (_id, city) => ({ perDay: city === 'Lymhurst' ? 40 : 0.2, avgPrice: null })

  it('picks the best route among items that actually sell once sales load', () => {
    const ranked = rankFlips(flips, DEFAULT_FLIP_FILTERS, NOW, sales)
    expect(ranked).toHaveLength(1)
    expect(ranked[0].sellMarket).toBe('Lymhurst')
    expect(flipVolume(ranked[0], sales)).toBe(40)
    expect(flipVolume(ranked[0], undefined)).toBeNull()
  })

  it('sorts by sales per day', () => {
    const ranked = rankFlips(flips, { ...DEFAULT_FLIP_FILTERS, bestRouteOnly: false, minDailySales: null, sortBy: 'volume' }, NOW, sales)
    expect(ranked[0].sellMarket).toBe('Lymhurst')
  })
})

describe('flip items', () => {
  it('lists resources and crafted gear', () => {
    expect(RESOURCE_ITEMS.map((i) => i.id)).toContain('T8_PLANKS_LEVEL4@4')
    expect(RESOURCE_ITEMS.map((i) => i.id)).not.toContain('T3_ORE_LEVEL1@1')
    expect(flipItemsFor('bags', 'all').map((i) => i.id)).toContain('T4_BAG')
  })

  it('leaves the Black Market out of resource flips', () => {
    expect(flipMarketsFor('resources')).not.toContain(BLACK_MARKET)
    expect(flipMarketsFor('weapons')).toContain(BLACK_MARKET)
  })
})
