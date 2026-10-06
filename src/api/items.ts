export type ResourceKind = 'ore' | 'hide' | 'fiber' | 'wood' | 'stone'

export const RESOURCES: Record<ResourceKind, { label: string; raw: string; refined: string }> = {
  ore: { label: 'Ore → Metal bar', raw: 'ORE', refined: 'METALBAR' },
  hide: { label: 'Hide → Leather', raw: 'HIDE', refined: 'LEATHER' },
  fiber: { label: 'Fiber → Cloth', raw: 'FIBER', refined: 'CLOTH' },
  wood: { label: 'Wood → Planks', raw: 'WOOD', refined: 'PLANKS' },
  stone: { label: 'Stone → Stone block', raw: 'ROCK', refined: 'STONEBLOCK' },
}

export const TIERS = [2, 3, 4, 5, 6, 7, 8] as const
export const ENCHANTMENTS = [0, 1, 2, 3, 4] as const

/** e.g. itemId(4, 'ORE', 2) === 'T4_ORE_LEVEL2@2' */
export function itemId(tier: number, base: string, enchantment = 0): string {
  const id = `T${tier}_${base}`
  return enchantment ? `${id}_LEVEL${enchantment}@${enchantment}` : id
}
