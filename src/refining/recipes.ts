import { RESOURCES, itemId, type ResourceKind } from '../api/items'

interface Ingredient {
  itemId: string
  count: number
}

export interface Recipe {
  resource: ResourceKind
  tier: number
  enchantment: number
  /** The refined item produced (one per craft). */
  output: string
  ingredients: Ingredient[]
}

/** Raw resources needed per refined item, by tier. */
const RAW_PER_CRAFT: Record<number, number> = { 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 5, 8: 5 }

const MIN_TIER = 2
const MAX_TIER = 8
/** Enchanted resources exist from T4 up. */
export const MIN_ENCHANT_TIER = 4

export function getRecipe(resource: ResourceKind, tier: number, enchantment = 0): Recipe {
  if (tier < MIN_TIER || tier > MAX_TIER) throw new Error(`No refining recipe for T${tier}`)
  if (enchantment < 0 || enchantment > RESOURCES[resource].maxEnchant.refined) throw new Error(`No T${tier}.${enchantment} ${resource}`)
  if (enchantment > 0 && tier < MIN_ENCHANT_TIER) throw new Error(`T${tier} has no enchanted resources`)

  const { raw, refined } = RESOURCES[resource]
  const ingredients: Ingredient[] = [{ itemId: itemId(tier, raw, enchantment), count: RAW_PER_CRAFT[tier] }]
  if (tier > MIN_TIER) {
    // The lower-tier refined input keeps the enchantment, except T3 which has none.
    const lowerEnchant = tier - 1 >= MIN_ENCHANT_TIER ? enchantment : 0
    ingredients.push({ itemId: itemId(tier - 1, refined, lowerEnchant), count: 1 })
  }
  return { resource, tier, enchantment, output: itemId(tier, refined, enchantment), ingredients }
}

/** Every refining recipe: 5 resources × T2–T8 × enchantments where they exist (none for stone). */
export function allRecipes(): Recipe[] {
  const recipes: Recipe[] = []
  for (const resource of Object.keys(RESOURCES) as ResourceKind[]) {
    for (let tier = MIN_TIER; tier <= MAX_TIER; tier++) {
      const maxEnchant = tier >= MIN_ENCHANT_TIER ? RESOURCES[resource].maxEnchant.refined : 0
      for (let enchantment = 0; enchantment <= maxEnchant; enchantment++) {
        recipes.push(getRecipe(resource, tier, enchantment))
      }
    }
  }
  return recipes
}

/** Every item id any recipe reads or produces, for one price request. */
export function allRefiningItemIds(recipes: Recipe[] = allRecipes()): string[] {
  const ids = new Set<string>()
  for (const r of recipes) {
    ids.add(r.output)
    for (const i of r.ingredients) ids.add(i.itemId)
  }
  return [...ids]
}
