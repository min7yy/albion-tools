import { GEAR_SLOTS, type GearSlot, type MetaSummary } from '../meta/aggregate'
import { GEAR, type Gear } from './gear'
import { valueFrontier, weaponOptions, type OfferSettings, type QualityPriceLookup, type WeaponOption } from './value'
import type { Weapon } from './weapons'

export interface SetPiece {
  slot: GearSlot | 'MainHand'
  base: string
  name: string
  frontier: WeaponOption[]
}

export interface SetChoice {
  picks: { piece: SetPiece; option: WeaponOption }[]
  price: number
  /** Average over the six slots; a two-handed weapon fills the off-hand slot too. */
  itemPower: number
  /** Slots left empty because the usual item had no recent price. */
  missing: GearSlot[]
}

/** The item most often seen with a weapon in each slot (no off-hand for two-handed weapons). */
export function usualGear(weapon: Weapon, summary: MetaSummary): Gear[] {
  const seen = summary.weapons[weapon.base]?.gear
  if (!seen) return []
  const out: Gear[] = []
  for (const slot of GEAR_SLOTS) {
    if (slot === 'OffHand' && weapon.twoHanded) continue
    // Most common first; skip anything we have no item data for (e.g. event items).
    const pick = seen[slot]?.map(([base]) => GEAR.get(base)).find((g) => g && g.slot === slot)
    if (pick) out.push(pick)
  }
  return out
}

/** Version frontiers for a weapon and its usual gear. */
export function setPieces(weapon: Weapon, gear: Gear[], prices: QualityPriceLookup, settings: OfferSettings): SetPiece[] {
  const piece = (slot: SetPiece['slot'], item: Weapon | Gear): SetPiece => ({
    slot,
    base: item.base,
    name: item.name,
    frontier: valueFrontier(weaponOptions(item, prices, settings)),
  })
  return [piece('MainHand', weapon), ...gear.map((g) => piece(g.slot, g))]
}

function averagePower(picks: SetChoice['picks'], twoHanded: boolean): number {
  let total = 0
  for (const { piece, option } of picks) total += option.itemPower * (piece.slot === 'MainHand' && twoHanded ? 2 : 1)
  return total / (picks.length + (twoHanded ? 1 : 0))
}

/**
 * Best average item power for the budget. Starts every slot on its cheapest version, then
 * repeatedly takes the upgrade that adds the most item power per silver until nothing fits.
 * The weapon counts double when two-handed, as it does in game.
 */
export function bestSet(weapon: Weapon, pieces: SetPiece[], budget: number): SetChoice | null {
  const priced = pieces.filter((p) => p.frontier.length > 0)
  if (!priced.length || priced[0].slot !== 'MainHand') return null
  const at = priced.map(() => 0)
  let spent = priced.reduce((sum, p) => sum + p.frontier[0].price, 0)
  if (spent > budget) return null

  for (;;) {
    let best: { slot: number; to: number; ratio: number; cost: number } | null = null
    priced.forEach((p, i) => {
      const from = p.frontier[at[i]]
      const weight = p.slot === 'MainHand' && weapon.twoHanded ? 2 : 1
      for (let j = at[i] + 1; j < p.frontier.length; j++) {
        const to = p.frontier[j]
        const cost = to.price - from.price
        if (spent + cost > budget) break
        const ratio = ((to.itemPower - from.itemPower) * weight) / cost
        if (!best || ratio > best.ratio) best = { slot: i, to: j, ratio, cost }
      }
    })
    if (!best) break
    const { slot, to, cost } = best
    at[slot] = to
    spent += cost
  }

  const picks = priced.map((piece, i) => ({ piece, option: piece.frontier[at[i]] }))
  const missing = pieces.filter((p) => !p.frontier.length && p.slot !== 'MainHand').map((p) => p.slot as GearSlot)
  return { picks, price: spent, itemPower: Math.round(averagePower(picks, weapon.twoHanded)), missing }
}

/** Cheapest complete set, for the slider's lower end. */
export function cheapestSet(pieces: SetPiece[]): number {
  return pieces.reduce((sum, p) => sum + (p.frontier[0]?.price ?? 0), 0)
}

/** Dearest version of every slot, for the slider's upper end. */
export function dearestSet(pieces: SetPiece[]): number {
  return pieces.reduce((sum, p) => sum + (p.frontier[p.frontier.length - 1]?.price ?? 0), 0)
}
