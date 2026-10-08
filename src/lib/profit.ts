import type { Price } from '../api/prices'

export type TradeMode = 'instant' | 'order'

/** Looks up a price for an item in a city; returns undefined when unknown. */
export type PriceLookup = (itemId: string, city: string) => Price | undefined

export interface TradeSettings {
  /** Premium halves the sales tax (4% instead of 8%). */
  premium: boolean
  /** instant: buy from the cheapest sell order. order: place a buy order at the top buy price. */
  buyMode: TradeMode
  /** instant: sell to the top buy order. order: list a sell order at the cheapest sell price. */
  sellMode: TradeMode
}

export const SALES_TAX_PREMIUM = 0.04
export const SALES_TAX_NO_PREMIUM = 0.08
/** Charged when placing a buy or sell order, on top of sales tax. */
export const ORDER_SETUP_FEE = 0.025

/** Production bonus (in %) every royal city gives for refining and crafting. */
export const BASE_CITY_BONUS = 18
export const FOCUS_BONUS = 59

/** Resource return rate for a production bonus in %: 1 - 1 / (1 + bonus / 100). */
export function returnRateForBonus(bonus: number): number {
  return 1 - 1 / (1 + bonus / 100)
}

/** Station fee for one craft: nutrition is 11.25% of the item value. */
export function stationFeeForValue(itemValue: number, feePer100: number): number {
  return (itemValue * 0.1125 * feePer100) / 100
}

export interface Ingredient {
  itemId: string
  count: number
  /** Not returned by the resource return rate (artifacts). */
  noReturn?: boolean
}

export interface IngredientCost extends Ingredient {
  unitPrice: number | null
  /** count × unitPrice, before returns. */
  total: number | null
}

export interface ProfitInput {
  output: string
  /** Items produced per craft. */
  amount?: number
  ingredients: Ingredient[]
  returnRate: number
  /** Station fee per craft. */
  stationFee: number
  prices: PriceLookup
  settings: TradeSettings
  buyCity: string
  sellCity: string
}

export interface ProfitResult {
  buyCity: string
  sellCity: string
  amount: number
  returnRate: number
  ingredients: IngredientCost[]
  /** Ingredient cost before returns. */
  grossInputCost: number | null
  /** Silver saved by resources being returned. */
  returnedValue: number | null
  /** Setup fee on buy orders (0 when buying instantly). */
  buyFee: number
  stationFee: number
  /** Price of one output item. */
  sellPrice: number | null
  /** Sales tax plus sell order setup fee, for the whole craft. */
  sellFees: number
  /** Silver after fees from selling the whole craft. */
  netRevenue: number | null
  /** Everything paid per craft after returns. */
  totalCost: number | null
  /** Profit per craft. */
  profit: number | null
  /** profit / totalCost. */
  margin: number | null
  /** Oldest price date used, to judge how stale the result is. */
  oldestPriceDate: Date | null
  /** Items with no price, which make the result incomplete. */
  missing: string[]
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/** Profit for one craft (or refine) with a full cost breakdown. */
export function evaluateProfit(input: ProfitInput): ProfitResult {
  const { output, ingredients: recipe, returnRate: rate, prices, settings, buyCity, sellCity } = input
  const amount = input.amount ?? 1
  const missing: string[] = []
  let oldest: Date | null = null
  const noteDate = (d: Date | null) => {
    if (d && (!oldest || d < oldest)) oldest = d
  }

  const ingredients: IngredientCost[] = recipe.map((ing) => {
    const p = prices(ing.itemId, buyCity)
    const unitPrice = settings.buyMode === 'instant' ? (p?.sellMin ?? null) : (p?.buyMax ?? null)
    noteDate(settings.buyMode === 'instant' ? (p?.sellMinDate ?? null) : (p?.buyMaxDate ?? null))
    if (unitPrice === null) missing.push(ing.itemId)
    return { ...ing, unitPrice, total: unitPrice === null ? null : unitPrice * ing.count }
  })

  const out = prices(output, sellCity)
  const sellPrice = settings.sellMode === 'instant' ? (out?.buyMax ?? null) : (out?.sellMin ?? null)
  noteDate(settings.sellMode === 'instant' ? (out?.buyMaxDate ?? null) : (out?.sellMinDate ?? null))
  if (sellPrice === null) missing.push(output)

  const fee = round(input.stationFee)
  const complete = missing.length === 0
  const grossInputCost = complete ? ingredients.reduce((sum, i) => sum + (i.total ?? 0), 0) : null
  const returnable = complete ? ingredients.reduce((sum, i) => sum + (i.noReturn ? 0 : (i.total ?? 0)), 0) : null
  const returnedValue = returnable === null ? null : round(returnable * rate)
  const netInputCost = grossInputCost === null || returnable === null ? null : grossInputCost - returnable * rate
  const buyFee = netInputCost !== null && settings.buyMode === 'order' ? round(netInputCost * ORDER_SETUP_FEE) : 0

  const taxRate = settings.premium ? SALES_TAX_PREMIUM : SALES_TAX_NO_PREMIUM
  const sellFeeRate = taxRate + (settings.sellMode === 'order' ? ORDER_SETUP_FEE : 0)
  const sellFees = sellPrice === null ? 0 : round(sellPrice * amount * sellFeeRate)
  const netRevenue = sellPrice === null ? null : round(sellPrice * amount - sellFees)

  const totalCost = netInputCost === null ? null : round(netInputCost + buyFee + fee)
  const profit = complete && totalCost !== null && netRevenue !== null ? round(netRevenue - totalCost) : null
  const margin = profit !== null && totalCost ? profit / totalCost : null

  return {
    buyCity,
    sellCity,
    amount,
    returnRate: rate,
    ingredients,
    grossInputCost,
    returnedValue,
    buyFee,
    stationFee: fee,
    sellPrice,
    sellFees,
    netRevenue,
    totalCost,
    profit,
    margin,
    oldestPriceDate: oldest,
    missing,
  }
}
