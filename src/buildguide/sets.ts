import { GEAR_SLOTS, type GearSlot, type MetaSummary } from '../meta/aggregate'
import { GEAR, type Gear } from './gear'
import type { Weapon } from './weapons'

/** Items considered per slot: the usual one, then the next most common if a city doesn't sell it. */
export const GEAR_CHOICES = 3
/** Common non-artifact items added after those, so one rare item can't sink a whole set. */
export const FALLBACK_CHOICES = 3

/** Plain items every market stocks, used when the kill data has nothing common for a slot. */
const DEFAULT_GEAR: Record<GearSlot, string> = {
  OffHand: 'OFF_TORCH',
  Head: 'HEAD_LEATHER_SET1',
  Armor: 'ARMOR_LEATHER_SET1',
  Shoes: 'SHOES_LEATHER_SET1',
  Cape: 'CAPE',
}

/** Artifact, faction and event items: pricey or thinly listed, so not good substitutes. */
export function isCommonGear(base: string): boolean {
  return !/_(KEEPER|HELL|MORGANA|UNDEAD|AVALON|CRYSTAL|FEY)$/.test(base) && !base.startsWith('CAPEITEM_')
}

/** Common items per slot across every weapon in the kill data, most worn first. */
export function commonGear(summary: MetaSummary, perSlot = FALLBACK_CHOICES): Record<GearSlot, Gear[]> {
  const out = {} as Record<GearSlot, Gear[]>
  for (const slot of GEAR_SLOTS) {
    const counts = new Map<string, number>()
    for (const w of Object.values(summary.weapons))
      for (const [base, n] of w.gear[slot] ?? []) if (isCommonGear(base)) counts.set(base, (counts.get(base) ?? 0) + n)
    const ranked = [...counts].sort((a, b) => b[1] - a[1]).map(([base]) => base)
    if (!ranked.includes(DEFAULT_GEAR[slot])) ranked.push(DEFAULT_GEAR[slot])
    out[slot] = ranked
      .map((base) => GEAR.get(base))
      .filter((g): g is Gear => g?.slot === slot)
      .slice(0, perSlot)
  }
  return out
}

/**
 * Items to try in each slot, in order: the ones most often seen with the weapon, then common
 * items worn with anything (no off-hand for two-handed weapons). Every slot gets some.
 */
export function usualGear(weapon: Weapon, summary: MetaSummary, perSlot = GEAR_CHOICES): Gear[][] {
  const seen = summary.weapons[weapon.base]?.gear ?? {}
  const common = commonGear(summary)
  const out: Gear[][] = []
  for (const slot of GEAR_SLOTS) {
    if (slot === 'OffHand' && weapon.twoHanded) continue
    // Skip anything we have no item data for (e.g. event items).
    const usual = (seen[slot] ?? [])
      .map(([base]) => GEAR.get(base))
      .filter((g): g is Gear => g?.slot === slot)
      .slice(0, perSlot)
    out.push([...usual, ...common[slot].filter((g) => !usual.includes(g))])
  }
  return out
}
