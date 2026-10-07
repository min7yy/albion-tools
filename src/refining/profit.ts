import type { Price } from '../api/prices'
import type { Recipe } from './recipes'
import {
  ORDER_SETUP_FEE,
  SALES_TAX_NO_PREMIUM,
  SALES_TAX_PREMIUM,
  returnRate,
  stationFee,
  type RefiningSettings,
} from './settings'

/** Looks up a price for an item in a city; returns undefined when unknown. */
export type PriceLookup = (itemId: string, city: string) => Price | undefined

export interface IngredientCost {
  itemId: string
  count: number
  unitPrice: number | null
  /** count × unitPrice, before returns. */
  total: number | null
}

export interface RefiningResult {
  recipe: Recipe
  buyCity: string
  refineCity: string
  sellCity: string
  returnRate: number
  ingredients: IngredientCost[]
  /** Ingredient cost before returns. */
  grossInputCost: number | null
  /** Silver saved by resources being returned. */
  returnedValue: number | null
  /** Setup fee on buy orders (0 when buying instantly). */
  buyFee: number
  stationFee: number
  sellPrice: number | null
  /** Sales tax plus sell order setup fee. */
  sellFees: number
  /** Silver after fees from selling one refined item. */
  netRevenue: number | null
  /** Everything paid per refined item after returns. */
  totalCost: number | null
  profit: number | null
  /** profit / totalCost. */
  margin: number | null
  /** Oldest price date used, to judge how stale the result is. */
  oldestPriceDate: Date | null
  /** Items with no price, which make the result incomplete. */
  missing: string[]
}

export interface EvaluateOptions {
  recipe: Recipe
  prices: PriceLookup
  settings: RefiningSettings
  refineCity: string
  /** Defaults to refineCity. */
  buyCity?: string
  /** Defaults to refineCity. */
  sellCity?: string
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/** Profit for refining one item, with a full cost breakdown. */
export function evaluateRefining({
  recipe,
  prices,
  settings,
  refineCity,
  buyCity = refineCity,
  sellCity = refineCity,
}: EvaluateOptions): RefiningResult {
  const missing: string[] = []
  let oldest: Date | null = null
  const noteDate = (d: Date | null) => {
    if (d && (!oldest || d < oldest)) oldest = d
  }

  const ingredients: IngredientCost[] = recipe.ingredients.map(({ itemId, count }) => {
    const p = prices(itemId, buyCity)
    const unitPrice = settings.buyMode === 'instant' ? (p?.sellMin ?? null) : (p?.buyMax ?? null)
    noteDate(settings.buyMode === 'instant' ? (p?.sellMinDate ?? null) : (p?.buyMaxDate ?? null))
    if (unitPrice === null) missing.push(itemId)
    return { itemId, count, unitPrice, total: unitPrice === null ? null : unitPrice * count }
  })

  const out = prices(recipe.output, sellCity)
  const sellPrice = settings.sellMode === 'instant' ? (out?.buyMax ?? null) : (out?.sellMin ?? null)
  noteDate(settings.sellMode === 'instant' ? (out?.buyMaxDate ?? null) : (out?.sellMinDate ?? null))
  if (sellPrice === null) missing.push(recipe.output)

  const rate = settings.returnRateOverride ?? returnRate(recipe.resource, refineCity, settings.useFocus)
  const fee = round(stationFee(recipe.tier, recipe.enchantment, settings.stationFeePer100))

  const complete = missing.length === 0
  const grossInputCost = complete ? ingredients.reduce((sum, i) => sum + (i.total ?? 0), 0) : null
  const returnedValue = grossInputCost === null ? null : round(grossInputCost * rate)
  const netInputCost = grossInputCost === null ? null : grossInputCost - grossInputCost * rate
  const buyFee = netInputCost !== null && settings.buyMode === 'order' ? round(netInputCost * ORDER_SETUP_FEE) : 0

  const taxRate = settings.premium ? SALES_TAX_PREMIUM : SALES_TAX_NO_PREMIUM
  const sellFeeRate = taxRate + (settings.sellMode === 'order' ? ORDER_SETUP_FEE : 0)
  const sellFees = sellPrice === null ? 0 : round(sellPrice * sellFeeRate)
  const netRevenue = sellPrice === null ? null : round(sellPrice - sellFees)

  const totalCost = netInputCost === null ? null : round(netInputCost + buyFee + fee)
  const profit = complete && totalCost !== null && netRevenue !== null ? round(netRevenue - totalCost) : null
  const margin = profit !== null && totalCost ? profit / totalCost : null

  return {
    recipe,
    buyCity,
    refineCity,
    sellCity,
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
