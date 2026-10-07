import type { PriceLookup } from '../profit'
import type { CraftRecipe } from './data'
import { BLACK_MARKET, evaluateCrafting, type CraftingResult, type CraftingSettings } from './evaluate'

export type SortKey = 'profit' | 'margin'
/** Where to sell: the city you craft in, or a fixed market for every row. */
export type SellLocation = 'same' | typeof BLACK_MARKET | 'Caerleon'

export interface CraftingFilters {
  category: string
  sub: string
  tier: number | 'all'
  enchantment: number | 'all'
  city: string | 'all'
  sellAt: SellLocation
  hideIncomplete: boolean
  maxAgeHours: number | null
  sortBy: SortKey
}

export const DEFAULT_CRAFTING_FILTERS: CraftingFilters = {
  category: 'weapons',
  sub: 'sword',
  tier: 'all',
  enchantment: 'all',
  city: 'all',
  sellAt: 'same',
  hideIncomplete: true,
  maxAgeHours: 24,
  sortBy: 'profit',
}

/** The recipes a category / sub-category selection covers. Prices are fetched for these only. */
export function recipesFor(recipes: CraftRecipe[], filters: Pick<CraftingFilters, 'category' | 'sub'>): CraftRecipe[] {
  return recipes.filter((r) => r.category === filters.category && (filters.sub === 'all' || r.sub === filters.sub))
}

/** Every item id the recipes buy or sell, for one price request. */
export function craftingItemIds(recipes: CraftRecipe[]): string[] {
  const ids = new Set<string>()
  for (const r of recipes) {
    ids.add(r.id)
    for (const [id] of r.resources) ids.add(id)
  }
  return [...ids]
}

export function evaluateAllCrafting(
  recipes: CraftRecipe[],
  cities: readonly string[],
  sellAt: SellLocation,
  prices: PriceLookup,
  settings: CraftingSettings,
): CraftingResult[] {
  return recipes.flatMap((recipe) =>
    cities.map((city) => evaluateCrafting(recipe, city, sellAt === 'same' ? city : sellAt, prices, settings)),
  )
}

export function rankCrafting(results: CraftingResult[], filters: CraftingFilters, now = Date.now()): CraftingResult[] {
  const maxAgeMs = filters.maxAgeHours === null ? null : filters.maxAgeHours * 3600_000
  const value = (r: CraftingResult) => (filters.sortBy === 'profit' ? r.profit : r.margin)
  return results
    .filter((r) => filters.tier === 'all' || r.recipe.tier === filters.tier)
    .filter((r) => filters.enchantment === 'all' || r.recipe.ench === filters.enchantment)
    .filter((r) => filters.city === 'all' || r.craftCity === filters.city)
    .filter((r) => !filters.hideIncomplete || r.profit !== null)
    .filter(
      (r) =>
        maxAgeMs === null ||
        r.profit === null ||
        (r.oldestPriceDate !== null && now - r.oldestPriceDate.getTime() <= maxAgeMs),
    )
    .sort((a, b) => (value(b) ?? -Infinity) - (value(a) ?? -Infinity))
}

export function craftingKey(r: CraftingResult): string {
  return `${r.recipe.id}|${r.craftCity}|${r.sellCity}`
}
