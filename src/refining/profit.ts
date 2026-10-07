import { evaluateProfit, type PriceLookup, type ProfitResult } from '../profit'
import type { Recipe } from './recipes'
import { returnRate, stationFee, type RefiningSettings } from './settings'

export type { PriceLookup, IngredientCost } from '../profit'

export interface RefiningResult extends ProfitResult {
  recipe: Recipe
  refineCity: string
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

/** Profit for refining one item, with a full cost breakdown. */
export function evaluateRefining({
  recipe,
  prices,
  settings,
  refineCity,
  buyCity = refineCity,
  sellCity = refineCity,
}: EvaluateOptions): RefiningResult {
  const result = evaluateProfit({
    output: recipe.output,
    ingredients: recipe.ingredients,
    returnRate: settings.returnRateOverride ?? returnRate(recipe.resource, refineCity, settings.useFocus),
    stationFee: stationFee(recipe.tier, recipe.enchantment, settings.stationFeePer100),
    prices,
    settings,
    buyCity,
    sellCity,
  })
  return { ...result, recipe, refineCity }
}
