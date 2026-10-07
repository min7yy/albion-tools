import { RESOURCES, TIERS, ENCHANTMENTS, itemId } from '../api/items'
import { MIN_ENCHANT_TIER } from '../refining/recipes'
import { CRAFT_RECIPES } from '../crafting/data'

export interface FlipItem {
  id: string
  tier: number
  ench: number
}

/** Raw and refined resources, every tier and enchantment. */
export const RESOURCE_ITEMS: FlipItem[] = Object.values(RESOURCES).flatMap((r) =>
  TIERS.flatMap((tier) =>
    ENCHANTMENTS.filter((ench) => ench === 0 || tier >= MIN_ENCHANT_TIER).flatMap((ench) => [
      { id: itemId(tier, r.raw, ench), tier, ench },
      { id: itemId(tier, r.refined, ench), tier, ench },
    ]),
  ),
)

/** The items a category / sub-category selection covers, before tier filters. */
export function flipItemsFor(category: string, sub: string): FlipItem[] {
  if (category === 'resources') return RESOURCE_ITEMS
  return CRAFT_RECIPES.filter((r) => r.category === category && (sub === 'all' || r.sub === sub)).map((r) => ({
    id: r.id,
    tier: r.tier,
    ench: r.ench,
  }))
}
