// How much stronger item power makes each slot, from the game's own data
// (ao-bin-dumps gamedata.json, Items > ItemPowerProgression). Every 100 item power multiplies:
//   two-handed weapon damage by 1.0918, one-handed main hand by 1.0825 (the off-hand makes up the gap),
//   hit points by 1.06 (helmet 25%, armour 50%, shoes 25% of the total),
//   armour and magic resistance by 1.03 (all from the armour piece).
// Fights are won on damage × survivability, so strength is the product of those multipliers
// and each slot is worth a fixed number of log points per item power.
import type { GearSlot } from '../meta/aggregate'

export type SetSlot = GearSlot | 'MainHand'

const per100 = (factor: number) => Math.log(factor) / 100

const DAMAGE_2H = per100(1.0918)
const DAMAGE_1H = per100(1.0825)
const HIT_POINTS = per100(1.06)
const RESISTANCE = per100(1.03)
/**
 * Each armour piece also carries one active spell that scales like weapon damage. Assumed to be
 * about 15% of what a player does in a fight, so it's a modest extra on top of hit points.
 */
const ARMOUR_SPELL = 0.15 * DAMAGE_2H
/** Capes give a passive and 10% of energy; treated as half a spell. */
const CAPE = ARMOUR_SPELL / 2

/** Log strength per point of item power in each slot. */
export function slotWeight(slot: SetSlot, twoHanded: boolean): number {
  switch (slot) {
    case 'MainHand':
      return twoHanded ? DAMAGE_2H : DAMAGE_1H
    case 'OffHand':
      return DAMAGE_2H - DAMAGE_1H
    case 'Armor':
      return 0.5 * HIT_POINTS + RESISTANCE + ARMOUR_SPELL
    case 'Head':
    case 'Shoes':
      return 0.25 * HIT_POINTS + ARMOUR_SPELL
    case 'Cape':
      return CAPE
  }
}

/** Item power every set is measured against: a plain T4 set. */
export const BASELINE_ITEM_POWER = 800

/**
 * Strength of a set compared with the same set at T4.0 normal quality, as a multiplier:
 * 1.5 means it hits harder and survives longer by a combined 50%.
 */
export function strength(pieces: { slot: SetSlot; itemPower: number }[], twoHanded: boolean): number {
  let log = 0
  for (const p of pieces) log += slotWeight(p.slot, twoHanded) * (p.itemPower - BASELINE_ITEM_POWER)
  return Math.exp(log)
}

/** Share of spec item power each tier adds on top (the mastery modifier): T5 5% up to T8 20%. */
export function masteryModifier(tier: number): number {
  return Math.max(0, tier - 4) * 0.05
}

/**
 * Extra item power a version gets from spec beyond what every version gets. Spec itself is the
 * same whatever you buy, so only the tier's mastery modifier changes the choice.
 */
export function specBonus(tier: number, specItemPower: number): number {
  return Math.round(specItemPower * masteryModifier(tier))
}
