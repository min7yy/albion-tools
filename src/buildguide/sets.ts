import { GEAR_SLOTS, type GearSlot, type MetaSummary } from '../meta/aggregate'
import { GEAR, type Gear } from './gear'
import type { Weapon } from './weapons'

/** Plain items every market stocks, used when the kill data has nothing for a slot. */
const DEFAULT_GEAR: Record<GearSlot, string> = {
  OffHand: 'OFF_TORCH',
  Head: 'HEAD_LEATHER_SET1',
  Armor: 'ARMOR_LEATHER_SET1',
  Shoes: 'SHOES_LEATHER_SET1',
  Cape: 'CAPE',
}

/** The most common item per slot across every weapon, or the slot's plain default. */
function commonItem(summary: MetaSummary, slot: GearSlot): Gear {
  const counts = new Map<string, number>()
  for (const w of Object.values(summary.weapons))
    for (const [base, n] of w.gear[slot] ?? []) if (GEAR.get(base)?.slot === slot) counts.set(base, (counts.get(base) ?? 0) + n)
  const top = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
  return GEAR.get(top ?? DEFAULT_GEAR[slot])!
}

/**
 * The item most often worn with a weapon in each slot (no off-hand for two-handed weapons),
 * falling back to the most common item overall where the weapon has none we know.
 */
export function usualGear(weapon: Weapon, summary: MetaSummary): Gear[] {
  const seen = summary.weapons[weapon.base]?.gear ?? {}
  return GEAR_SLOTS.filter((slot) => !(slot === 'OffHand' && weapon.twoHanded)).map((slot) => {
    // Skip anything we have no item data for (e.g. event items).
    const usual = (seen[slot] ?? []).map(([base]) => GEAR.get(base)).find((g) => g?.slot === slot)
    return usual ?? commonItem(summary, slot)
  })
}
