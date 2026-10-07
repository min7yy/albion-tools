import { GEAR_SLOTS, type MetaSummary } from '../meta/aggregate'
import { GEAR, type Gear } from './gear'
import type { Weapon } from './weapons'

/** Items considered per slot: the usual one, then the next most common if a city doesn't sell it. */
export const GEAR_CHOICES = 3

/**
 * The items most often seen with a weapon in each slot, most common first (no off-hand for
 * two-handed weapons). Slots with no known items are left out.
 */
export function usualGear(weapon: Weapon, summary: MetaSummary, perSlot = GEAR_CHOICES): Gear[][] {
  const seen = summary.weapons[weapon.base]?.gear
  if (!seen) return []
  const out: Gear[][] = []
  for (const slot of GEAR_SLOTS) {
    if (slot === 'OffHand' && weapon.twoHanded) continue
    // Skip anything we have no item data for (e.g. event items).
    const known = (seen[slot] ?? []).map(([base]) => GEAR.get(base)).filter((g): g is Gear => g?.slot === slot)
    if (known.length) out.push(known.slice(0, perSlot))
  }
  return out
}
