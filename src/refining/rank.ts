import type { ResourceKind } from '../api/items'
import { evaluateRefining, type PriceLookup, type RefiningResult } from './profit'
import type { Recipe } from './recipes'
import type { RefiningSettings } from './settings'

export type SortKey = 'profit' | 'margin'

export interface RefiningFilters {
  resource: ResourceKind | 'all'
  tier: number | 'all'
  enchantment: number | 'all'
  city: string | 'all'
  /** Hide rows with a missing price. */
  hideIncomplete: boolean
  /** Hide rows whose oldest price is older than this many hours. null = any age. */
  maxAgeHours: number | null
  sortBy: SortKey
}

export const DEFAULT_FILTERS: RefiningFilters = {
  resource: 'all',
  tier: 'all',
  enchantment: 'all',
  city: 'all',
  hideIncomplete: true,
  maxAgeHours: 24,
  sortBy: 'profit',
}

/** Evaluates every recipe in every city (buying, refining and selling in that city). */
export function evaluateAll(
  recipes: Recipe[],
  cities: readonly string[],
  prices: PriceLookup,
  settings: RefiningSettings,
): RefiningResult[] {
  return recipes.flatMap((recipe) =>
    cities.map((city) => evaluateRefining({ recipe, prices, settings, refineCity: city })),
  )
}

/** Applies filters and sorts best first. Rows without a profit sink to the bottom. */
export function rankResults(
  results: RefiningResult[],
  filters: RefiningFilters,
  now = Date.now(),
): RefiningResult[] {
  const maxAgeMs = filters.maxAgeHours === null ? null : filters.maxAgeHours * 3600_000
  const value = (r: RefiningResult) => (filters.sortBy === 'profit' ? r.profit : r.margin)
  return results
    .filter((r) => filters.resource === 'all' || r.recipe.resource === filters.resource)
    .filter((r) => filters.tier === 'all' || r.recipe.tier === filters.tier)
    .filter((r) => filters.enchantment === 'all' || r.recipe.enchantment === filters.enchantment)
    .filter((r) => filters.city === 'all' || r.refineCity === filters.city)
    .filter((r) => !filters.hideIncomplete || r.profit !== null)
    .filter(
      (r) =>
        maxAgeMs === null ||
        r.profit === null ||
        (r.oldestPriceDate !== null && now - r.oldestPriceDate.getTime() <= maxAgeMs),
    )
    .sort((a, b) => (value(b) ?? -Infinity) - (value(a) ?? -Infinity))
}

/** A stable id for a row, used to keep the selected row across re-renders. */
export function resultKey(r: RefiningResult): string {
  return `${r.recipe.output}|${r.refineCity}`
}
