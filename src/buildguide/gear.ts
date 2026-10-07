import data from '../data/gear.json'
import type { GearSlot } from '../meta/aggregate'
import { weaponItemId } from './weapons'

/** One off-hand, helmet, armour, pair of shoes or cape, as stored in src/data/gear.json. */
export interface Gear {
  base: string
  name: string
  slot: GearSlot
  /** [tier, enchantment, item power at normal quality]. */
  variants: [number, number, number][]
}

const typed = data as unknown as { source: string; gear: Gear[] }

export const GEAR: Map<string, Gear> = new Map(typed.gear.map((g) => [g.base, g]))

export const SLOT_LABELS: Record<GearSlot | 'MainHand', string> = {
  MainHand: 'Weapon',
  OffHand: 'Off-hand',
  Head: 'Helmet',
  Armor: 'Armour',
  Shoes: 'Shoes',
  Cape: 'Cape',
}

/** Market ids use the same pattern as weapons. */
export function gearItemIds(gear: Gear[]): string[] {
  return gear.flatMap((g) => g.variants.map(([tier, ench]) => weaponItemId(g.base, tier, ench)))
}
