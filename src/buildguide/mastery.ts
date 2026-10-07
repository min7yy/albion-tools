// Spec and the tier bonus, from the game's own files (ao-bin-dumps):
//   achievements.json: each spec level adds 2 item power to that one item, each mastery level
//     0.2 to its whole line (swords, plate helmets, ...). The same holds for armour.
//   items.json @masterymodifier: T5 0.05, T6 0.10, T7 0.15, T8 0.20 for weapons, off-hands and
//     armour. Capes have 0, so they get no tier bonus (and have no spec).
import type { GearSlot } from '../meta/aggregate'

export type SetSlot = GearSlot | 'MainHand'

/** Item power per level, from achievements.json: mastery covers the line, spec one item. */
export const MASTERY_IP_PER_LEVEL = 0.2
export const SPEC_IP_PER_LEVEL = 2

/** Spec item power from destiny board levels, before the tier bonus (what the tooltip shows at T4). */
export function specFromLevels(mastery: number, spec: number): number {
  return mastery * MASTERY_IP_PER_LEVEL + spec * SPEC_IP_PER_LEVEL
}

/** Share of spec item power a tier adds on top: T5 5% up to T8 20%. Capes get nothing. */
export function masteryModifier(tier: number, slot: SetSlot): number {
  if (slot === 'Cape') return 0
  return Math.max(0, tier - 4) * 0.05
}

/** Item power spec adds to one piece, including the tier bonus. */
export function specItemPower(tier: number, slot: SetSlot, spec: number): number {
  if (slot === 'Cape') return 0
  return Math.round(spec * (1 + masteryModifier(tier, slot)))
}
