import { evaluateProfit, type PriceLookup, type ProfitResult } from '../lib/profit'
import type { Recipe } from './recipes'
import { focusCost, returnRate, stationFee, type RefiningSettings } from './settings'

export type { PriceLookup } from '../lib/profit'

export interface RefiningResult extends ProfitResult {
  recipe: Recipe
  refineCity: string
  /** Focus spent per refine when using focus, after your cost reduction. */
  focusCost: number
  /**
   * Extra silver each focus point earns: (profit with focus - profit without) / focus cost.
   * null when a price is missing or the return rate is overridden.
   */
  silverPerFocus: number | null
  /** Profit per craft when refining with focus. */
  profitWithFocus: number | null
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
  const evaluate = (useFocus: boolean) =>
    evaluateProfit({
      output: recipe.output,
      ingredients: recipe.ingredients,
      returnRate: settings.returnRateOverride ?? returnRate(recipe.resource, refineCity, useFocus),
      stationFee: stationFee(recipe.tier, recipe.enchantment, settings.stationFeePer100),
      prices,
      settings,
      buyCity,
      sellCity,
    })
  const result = evaluate(settings.useFocus)
  const other = evaluate(!settings.useFocus)
  const cost = focusCost(recipe.tier, recipe.enchantment, settings.focusCostReduction)
  const [withFocus, without] = settings.useFocus ? [result, other] : [other, result]
  const silverPerFocus =
    settings.returnRateOverride !== null || withFocus.profit === null || without.profit === null || cost <= 0
      ? null
      : (withFocus.profit - without.profit) / cost
  return { ...result, recipe, refineCity, focusCost: cost, silverPerFocus, profitWithFocus: withFocus.profit }
}
