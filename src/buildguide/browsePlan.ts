import type { Gear } from './gear'
import { weaponTypeLabel } from './types'
import type { Weapon } from './weapons'

/**
 * What to open in the in-game market to refresh prices. The Albion Data Client uploads every
 * listing on any market page you open, so one category page (say Bows at T6) covers many items
 * at once; this groups the pieces that need prices into as few pages as possible.
 */

const GEAR_LABELS: Record<string, string> = {
  booktype: 'Books',
  torchtype: 'Torches',
  shieldtype: 'Shields',
  cloth_armor: 'Cloth armor',
  leather_armor: 'Leather armor',
  plate_armor: 'Plate armor',
  cloth_helmet: 'Cloth helmets',
  leather_helmet: 'Leather helmets',
  plate_helmet: 'Plate helmets',
  cloth_shoes: 'Cloth shoes',
  leather_shoes: 'Leather shoes',
  plate_shoes: 'Plate shoes',
}

/** The market category an item is listed under, as the game names it. */
export function marketCategory(item: Weapon | Gear): string {
  if ('twoHanded' in item) return weaponTypeLabel(item.sub)
  if (item.slot === 'Cape') return 'Capes'
  return GEAR_LABELS[item.sub] ?? { OffHand: 'Off-hands', Head: 'Helmets', Armor: 'Armor', Shoes: 'Shoes' }[item.slot]
}

export interface BrowsePage {
  category: string
  /** Tiers to set in the market filter, lowest first, e.g. ["T5.1", "T6.0"]. */
  tiers: string[]
  /** Pieces on screen this page refreshes. */
  items: string[]
}

export interface NeededPrice {
  city: string
  item: Weapon | Gear
  tier: number
  ench: number
}

/** Per city, the category pages to open, those covering the most pieces first. */
export function browsePlan(needed: NeededPrice[]): Map<string, BrowsePage[]> {
  const byCity = new Map<string, Map<string, { tiers: Set<string>; items: Set<string> }>>()
  for (const { city, item, tier, ench } of needed) {
    const pages = byCity.get(city) ?? new Map()
    byCity.set(city, pages)
    const category = marketCategory(item)
    const page = pages.get(category) ?? { tiers: new Set<string>(), items: new Set<string>() }
    pages.set(category, page)
    page.tiers.add(`T${tier}.${ench}`)
    page.items.add(item.name)
  }
  const plan = new Map<string, BrowsePage[]>()
  for (const city of [...byCity.keys()].sort()) {
    const pages = [...byCity.get(city)!].map(([category, p]) => ({
      category,
      tiers: [...p.tiers].sort(),
      items: [...p.items].sort(),
    }))
    pages.sort((a, b) => b.items.length - a.items.length || a.category.localeCompare(b.category))
    plan.set(city, pages)
  }
  return plan
}
