import { BASE_CITY_BONUS, FOCUS_BONUS, evaluateProfit, returnRateForBonus, stationFeeForValue, type PriceLookup, type ProfitResult } from '../lib/profit'
import type { RefiningSettings } from '../refining/settings'
import { CITY_CRAFTING_BONUSES, type CraftRecipe } from './data'

/** Same knobs as refining: focus, premium, station fee, buy/sell mode, return rate override. */
export type CraftingSettings = RefiningSettings

export const BLACK_MARKET = 'Black Market'

export interface CraftingResult extends ProfitResult {
  recipe: CraftRecipe
  craftCity: string
}

/** Extra production bonus (%) a city gives this crafting category, e.g. 15 for swords in Lymhurst. */
export function citySpecialtyBonus(city: string, craft: string | undefined): number {
  return (craft && CITY_CRAFTING_BONUSES[city]?.[craft]) || 0
}

/** Crafting return rate: the 18% city bonus, the city's specialty bonus for this item, plus focus. */
export function craftingReturnRate(city: string, useFocus: boolean, craft?: string): number {
  const bonus =
    (city === BLACK_MARKET ? 0 : BASE_CITY_BONUS + citySpecialtyBonus(city, craft)) + (useFocus ? FOCUS_BONUS : 0)
  return returnRateForBonus(bonus)
}

export function evaluateCrafting(
  recipe: CraftRecipe,
  craftCity: string,
  sellCity: string,
  prices: PriceLookup,
  settings: CraftingSettings,
): CraftingResult {
  // The Black Market only buys: selling there is always an instant sell to its buy orders.
  const trade = sellCity === BLACK_MARKET ? { ...settings, sellMode: 'instant' as const } : settings
  const result = evaluateProfit({
    output: recipe.id,
    amount: recipe.amount,
    ingredients: recipe.resources.map(([itemId, count, noReturn]) => ({ itemId, count, noReturn: !!noReturn })),
    returnRate: settings.returnRateOverride ?? craftingReturnRate(craftCity, settings.useFocus, recipe.craft),
    stationFee: stationFeeForValue(recipe.itemValue, settings.stationFeePer100),
    prices,
    settings: trade,
    buyCity: craftCity,
    sellCity,
  })
  return { ...result, recipe, craftCity }
}
