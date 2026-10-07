import type { SalesLookup } from '../api/history'
import { ORDER_SETUP_FEE, SALES_TAX_NO_PREMIUM, SALES_TAX_PREMIUM, type PriceLookup, type TradeSettings } from '../profit'

export const BLACK_MARKET = 'Black Market'

export interface Flip {
  itemId: string
  buyMarket: string
  sellMarket: string
  /** Price paid per item (sell order price for instant buys, top buy order for buy orders). */
  buyPrice: number
  /** Price received per item before tax. */
  sellPrice: number
  /** Buy order setup fee, tax and sell order setup fee. */
  fees: number
  profit: number
  /** profit / (buyPrice + buy fee). */
  margin: number
  /** Older of the two prices used. */
  oldestPriceDate: Date | null
}

function older(a: Date | null, b: Date | null): Date | null {
  if (!a) return b
  if (!b) return a
  return a < b ? a : b
}

/**
 * Every profitable-or-not route for one item: buy in one market, sell in another.
 * The Black Market only buys, so it is a sell market only and always an instant sell.
 */
export function flipsForItem(
  itemId: string,
  markets: readonly string[],
  prices: PriceLookup,
  settings: TradeSettings,
): Flip[] {
  const flips: Flip[] = []
  const taxRate = settings.premium ? SALES_TAX_PREMIUM : SALES_TAX_NO_PREMIUM
  for (const buyMarket of markets) {
    if (buyMarket === BLACK_MARKET) continue
    const from = prices(itemId, buyMarket)
    const buyPrice = settings.buyMode === 'instant' ? from?.sellMin : from?.buyMax
    if (!buyPrice) continue
    const buyDate = (settings.buyMode === 'instant' ? from?.sellMinDate : from?.buyMaxDate) ?? null
    const buyFee = settings.buyMode === 'order' ? buyPrice * ORDER_SETUP_FEE : 0

    for (const sellMarket of markets) {
      if (sellMarket === buyMarket) continue
      const to = prices(itemId, sellMarket)
      const sellInstant = sellMarket === BLACK_MARKET || settings.sellMode === 'instant'
      const sellPrice = sellInstant ? to?.buyMax : to?.sellMin
      if (!sellPrice) continue
      const sellDate = (sellInstant ? to?.buyMaxDate : to?.sellMinDate) ?? null
      const sellFees = sellPrice * (taxRate + (sellInstant ? 0 : ORDER_SETUP_FEE))
      const fees = buyFee + sellFees
      const profit = sellPrice - sellFees - buyPrice - buyFee
      flips.push({
        itemId,
        buyMarket,
        sellMarket,
        buyPrice,
        sellPrice,
        fees: Math.round(fees * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin: profit / (buyPrice + buyFee),
        oldestPriceDate: older(buyDate, sellDate),
      })
    }
  }
  return flips
}

export type FlipSortKey = 'profit' | 'margin' | 'volume'

export interface FlipFilters {
  /** "resources" or a crafting category id. */
  category: string
  /** Crafting sub-category, or "all". Ignored for resources. */
  sub: string
  tier: number | 'all'
  enchantment: number | 'all'
  buyMarket: string | 'all'
  sellMarket: string | 'all'
  /** Only show each item's best route. */
  bestRouteOnly: boolean
  /** Hide flips below this margin (0.05 = 5%). */
  minMargin: number
  maxAgeHours: number | null
  /** Hide flips whose item sells fewer than this many per day in the sell market. null = any. */
  minDailySales: number | null
  sortBy: FlipSortKey
}

export const DEFAULT_FLIP_FILTERS: FlipFilters = {
  category: 'resources',
  sub: 'all',
  tier: 'all',
  enchantment: 'all',
  buyMarket: 'all',
  sellMarket: 'all',
  bestRouteOnly: true,
  minMargin: 0.05,
  maxAgeHours: 6,
  minDailySales: 1,
  sortBy: 'profit',
}

/** Items sold per day in the flip's sell market, or null before sales data loads. */
export function flipVolume(f: Flip, sales: SalesLookup | undefined): number | null {
  return sales ? (sales(f.itemId, f.sellMarket)?.perDay ?? 0) : null
}

/**
 * Filters, keeps the best route per item if asked, and sorts best first.
 * The sales filter and sort only apply once `sales` has loaded.
 */
export function rankFlips(flips: Flip[], filters: FlipFilters, now = Date.now(), sales?: SalesLookup): Flip[] {
  const maxAgeMs = filters.maxAgeHours === null ? null : filters.maxAgeHours * 3600_000
  const key = (f: Flip) =>
    filters.sortBy === 'margin' ? f.margin : filters.sortBy === 'volume' ? (flipVolume(f, sales) ?? 0) : f.profit
  let kept = flips
    .filter((f) => filters.buyMarket === 'all' || f.buyMarket === filters.buyMarket)
    .filter((f) => filters.sellMarket === 'all' || f.sellMarket === filters.sellMarket)
    .filter((f) => f.profit > 0 && f.margin >= filters.minMargin)
    .filter(
      (f) => maxAgeMs === null || (f.oldestPriceDate !== null && now - f.oldestPriceDate.getTime() <= maxAgeMs),
    )
    .filter((f) => filters.minDailySales === null || !sales || flipVolume(f, sales)! >= filters.minDailySales)
    .sort((a, b) => key(b) - key(a))
  if (filters.bestRouteOnly) {
    const seen = new Set<string>()
    kept = kept.filter((f) => !seen.has(f.itemId) && !!seen.add(f.itemId))
  }
  return kept
}

export function flipKey(f: Flip): string {
  return `${f.itemId}|${f.buyMarket}|${f.sellMarket}`
}
