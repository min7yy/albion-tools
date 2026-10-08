import data from '../data/gear.json'
import type { GearSlot } from '../meta/aggregate'

/** One off-hand, helmet, armour, pair of shoes or cape, as stored in src/data/gear.json. */
export interface Gear {
  base: string
  name: string
  slot: GearSlot
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

/** Icons are drawn at one tier: the kill data says which items, and the item power says how strong. */
export const iconId = (base: string) => `T8_${base}`
