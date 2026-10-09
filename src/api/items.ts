export type ResourceKind = 'ore' | 'hide' | 'fiber' | 'wood' | 'stone'

export interface ResourceInfo {
  label: string
  raw: string
  refined: string
  rawName: string
  refinedName: string
  /** Highest enchantment the game has for the raw and refined item (stone stops at .3 raw and has no enchanted blocks). */
  maxEnchant: { raw: number; refined: number }
}

export const RESOURCES: Record<ResourceKind, ResourceInfo> = {
  ore: { label: 'Ore → Metal bar', raw: 'ORE', refined: 'METALBAR', rawName: 'Ore', refinedName: 'Metal bar', maxEnchant: { raw: 4, refined: 4 } },
  hide: { label: 'Hide → Leather', raw: 'HIDE', refined: 'LEATHER', rawName: 'Hide', refinedName: 'Leather', maxEnchant: { raw: 4, refined: 4 } },
  fiber: { label: 'Fiber → Cloth', raw: 'FIBER', refined: 'CLOTH', rawName: 'Fiber', refinedName: 'Cloth', maxEnchant: { raw: 4, refined: 4 } },
  wood: { label: 'Wood → Planks', raw: 'WOOD', refined: 'PLANKS', rawName: 'Wood', refinedName: 'Planks', maxEnchant: { raw: 4, refined: 4 } },
  stone: { label: 'Stone → Stone block', raw: 'ROCK', refined: 'STONEBLOCK', rawName: 'Stone', refinedName: 'Stone block', maxEnchant: { raw: 3, refined: 0 } },
}

export const TIERS = [2, 3, 4, 5, 6, 7, 8] as const
export const ENCHANTMENTS = [0, 1, 2, 3, 4] as const

/** e.g. itemId(4, 'ORE', 2) === 'T4_ORE_LEVEL2@2' */
export function itemId(tier: number, base: string, enchantment = 0): string {
  const id = `T${tier}_${base}`
  return enchantment ? `${id}_LEVEL${enchantment}@${enchantment}` : id
}

/** Readable name for a resource item id, e.g. "T5.2 Metal bar". Falls back to the id. */
export function itemName(id: string): string {
  const m = /^T(\d)_([A-Z]+)(?:_LEVEL(\d))?/.exec(id)
  if (!m) return id
  const [, tier, base, ench = '0'] = m
  for (const r of Object.values(RESOURCES)) {
    if (base === r.raw) return `T${tier}.${ench} ${r.rawName}`
    if (base === r.refined) return `T${tier}.${ench} ${r.refinedName}`
  }
  return id
}
