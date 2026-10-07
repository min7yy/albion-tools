import data from '../data/crafting.json'

/** One crafting recipe as stored in src/data/crafting.json (see scripts/build-crafting-data.mjs). */
export interface CraftRecipe {
  /** Market item id, e.g. T6_2H_CLAYMORE_AVALON@2 */
  id: string
  /** Item id without tier, shared by every tier and enchantment. */
  base: string
  tier: number
  ench: number
  /** English name without the tier prefix, e.g. "Kingmaker". */
  name: string
  category: string
  sub: string
  /** Items produced per craft. */
  amount: number
  /** Focus cost per craft. */
  focus: number
  /** Item value used for the station fee. */
  itemValue: number
  /** [itemId, count, noReturn?] — noReturn marks artifacts the return rate doesn't give back. */
  resources: [string, number, number?][]
}

interface CraftingData {
  source: string
  recipes: CraftRecipe[]
  ingredientNames: Record<string, string>
}

const typed = data as unknown as CraftingData

export const CRAFT_RECIPES: CraftRecipe[] = typed.recipes
export const INGREDIENT_NAMES: Record<string, string> = typed.ingredientNames

export const CATEGORY_LABELS: Record<string, string> = {
  weapons: 'Weapons',
  armors: 'Armour',
  head: 'Helmets',
  shoes: 'Shoes',
  offhands: 'Off-hands',
  capes: 'Capes',
  bags: 'Bags',
  gathering: 'Gathering gear',
}

export function subLabel(sub: string): string {
  if (sub === 'accessoires_capes_capes') return 'Capes'
  if (sub === 'other') return 'Other'
  return sub
    .replace(/type$/, '')
    .replace(/staff$/, ' staff')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
}

/** Category → its sub-categories, in a stable order. */
export const CATEGORIES: { id: string; subs: string[] }[] = Object.keys(CATEGORY_LABELS).map((id) => ({
  id,
  subs: [...new Set(CRAFT_RECIPES.filter((r) => r.category === id).map((r) => r.sub))].sort((a, b) =>
    a === 'other' ? 1 : b === 'other' ? -1 : a.localeCompare(b),
  ),
}))
