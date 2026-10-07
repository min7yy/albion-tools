import { GEAR_SLOTS, type GearSlot, type MetaSummary } from '../meta/aggregate'
import { GEAR, type Gear } from './gear'
import { BASELINE_ITEM_POWER, slotWeight, specBonus, type SetSlot } from './power'
import { valueFrontier, weaponOptions, type OfferSettings, type QualityPriceLookup, type WeaponOption } from './value'
import type { Weapon } from './weapons'

export interface SetPiece {
  slot: SetSlot
  base: string
  name: string
  frontier: WeaponOption[]
  /** 0 for the item most often seen with the weapon, 1 for the next most common, and so on. */
  rank: number
}

export interface SetChoice {
  /** Every piece is bought here: nobody wants to visit five cities for one set. */
  city: string
  picks: { piece: SetPiece; option: WeaponOption }[]
  price: number
  /** Average over the six slots; a two-handed weapon fills the off-hand slot too. */
  itemPower: number
  /** How much stronger than the same set at T4.0 normal quality (see power.ts). */
  strength: number
  /** Slots left empty because the usual item had no recent price in this city. */
  missing: GearSlot[]
}

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

/**
 * Version frontiers for a weapon and its gear, priced in one city. Each slot uses the most common
 * item the city sells; a slot where it sells none of them keeps the usual item with no versions.
 */
export function setPieces(
  weapon: Weapon,
  gear: Gear[][],
  prices: QualityPriceLookup,
  settings: OfferSettings,
  specItemPower = 0,
): SetPiece[] {
  const piece = (slot: SetSlot, item: Weapon | Gear, rank: number, bonus?: (tier: number) => number): SetPiece => ({
    slot,
    base: item.base,
    name: item.name,
    frontier: valueFrontier(weaponOptions(item, prices, settings, bonus)),
    rank,
  })
  const slots = gear.map((choices) => {
    const pieces = choices.map((g, rank) => piece(g.slot, g, rank))
    return pieces.find((p) => p.frontier.length > 0) ?? pieces[0]
  })
  return [piece('MainHand', weapon, 0, (tier) => specBonus(tier, specItemPower)), ...slots]
}

interface FrontPoint {
  price: number
  /** Log strength (see power.ts). */
  log: number
  /** This slot's frontier index, chained back to the earlier slots' picks. */
  pick: Pick | null
}
interface Pick {
  index: number
  prev: Pick | null
}

function indexes(point: FrontPoint): number[] {
  const out: number[] = []
  for (let p = point.pick; p; p = p.prev) out.unshift(p.index)
  return out
}

/** Every set worth buying in one city: dearer sets on the front are always stronger. */
export interface SetPlan {
  weapon: Weapon
  city: string
  pieces: SetPiece[]
  front: FrontPoint[]
}

/** Keeps the front small when there are many combinations; steps under 0.1% strength aren't worth showing. */
const MIN_STEP = 1e-3
const PRICE_BAND = Math.log(1.005)

/**
 * Exact best sets at every price: combines the slots one at a time and keeps only the
 * combinations that are stronger than every cheaper one.
 */
export function planSet(weapon: Weapon, city: string, pieces: SetPiece[]): SetPlan {
  const priced = pieces.filter((p) => p.frontier.length > 0)
  if (!priced.length || priced[0].slot !== 'MainHand') return { weapon, city, pieces, front: [] }
  let front: FrontPoint[] = [{ price: 0, log: 0, pick: null }]
  for (const piece of priced) {
    const weight = slotWeight(piece.slot, weapon.twoHanded)
    // Best combination per 0.5% price band, which avoids sorting tens of thousands of combinations.
    const bands = new Map<number, FrontPoint>()
    for (const p of front) {
      piece.frontier.forEach((o, i) => {
        const price = p.price + o.price
        const log = p.log + weight * (o.itemPower - BASELINE_ITEM_POWER)
        const band = Math.floor(Math.log(Math.max(price, 1)) / PRICE_BAND)
        const held = bands.get(band)
        if (!held || log > held.log || (log === held.log && price < held.price)) {
          bands.set(band, { price, log, pick: { index: i, prev: p.pick } })
        }
      })
    }
    front = []
    for (const band of [...bands.keys()].sort((x, y) => x - y)) {
      const p = bands.get(band)!
      if (!front.length || p.log > front[front.length - 1].log + MIN_STEP) front.push(p)
    }
  }
  return { weapon, city, pieces, front }
}

/** One plan per city, each pricing the whole set in that city only. */
export function planSets(
  weapon: Weapon,
  gear: Gear[][],
  prices: QualityPriceLookup,
  settings: OfferSettings,
  specItemPower = 0,
): SetPlan[] {
  return settings.cities.map((city) =>
    planSet(weapon, city, setPieces(weapon, gear, prices, { ...settings, cities: [city] }, specItemPower)),
  )
}

function averagePower(picks: SetChoice['picks'], twoHanded: boolean): number {
  let total = 0
  for (const { piece, option } of picks) total += option.itemPower * (piece.slot === 'MainHand' && twoHanded ? 2 : 1)
  return total / (picks.length + (twoHanded ? 1 : 0))
}

/** Strongest set from one city's plan that fits the budget. */
export function bestSet(plan: SetPlan, budget: number): SetChoice | null {
  let point: FrontPoint | null = null
  for (const p of plan.front) {
    if (p.price > budget) break
    point = p
  }
  if (!point) return null
  const priced = plan.pieces.filter((p) => p.frontier.length > 0)
  const at = indexes(point)
  const picks = priced.map((piece, i) => ({ piece, option: piece.frontier[at[i]] }))
  const missing = plan.pieces.filter((p) => !p.frontier.length && p.slot !== 'MainHand').map((p) => p.slot as GearSlot)
  return {
    city: plan.city,
    picks,
    price: point.price,
    itemPower: Math.round(averagePower(picks, plan.weapon.twoHanded)),
    strength: Math.exp(point.log),
    missing,
  }
}

/** Best city for the budget: complete sets first, then the strongest, then the cheapest. */
export function bestSetAnyCity(plans: SetPlan[], budget: number): SetChoice | null {
  let best: SetChoice | null = null
  for (const plan of plans) {
    const c = bestSet(plan, budget)
    if (!c) continue
    if (
      !best ||
      c.missing.length < best.missing.length ||
      (c.missing.length === best.missing.length &&
        (c.strength > best.strength || (c.strength === best.strength && c.price < best.price)))
    )
      best = c
  }
  return best
}

/** Cheapest set in any city, for the slider's lower end. */
export function cheapestSet(plans: SetPlan[]): number | null {
  const prices = plans.filter((p) => p.front.length).map((p) => p.front[0].price)
  return prices.length ? Math.min(...prices) : null
}

/** Dearest set worth buying in any city, for the slider's upper end. */
export function dearestSet(plans: SetPlan[]): number | null {
  const prices = plans.filter((p) => p.front.length).map((p) => p.front[p.front.length - 1].price)
  return prices.length ? Math.max(...prices) : null
}

/** A trip elsewhere is only suggested when it buys at least this much more strength. */
export const WORTH_THE_TRIP = 1.03

/**
 * The set to buy in the home city, plus the best set elsewhere when it's notably stronger for
 * the same budget (or complete where home's isn't). With no home city, or nothing affordable
 * there, the best city wins outright.
 */
export function homeAndBest(
  plans: SetPlan[],
  budget: number,
  home: string | null,
): { choice: SetChoice; elsewhere: SetChoice | null } | null {
  const best = bestSetAnyCity(plans, budget)
  if (!best) return null
  const homePlan = home ? plans.find((p) => p.city === home) : undefined
  const atHome = homePlan ? bestSet(homePlan, budget) : null
  if (!atHome) return { choice: best, elsewhere: null }
  const away = bestSetAnyCity(
    plans.filter((p) => p !== homePlan),
    budget,
  )
  const better =
    away &&
    (away.missing.length < atHome.missing.length ||
      (away.missing.length === atHome.missing.length && away.strength >= atHome.strength * WORTH_THE_TRIP))
  return { choice: atHome, elsewhere: better ? away : null }
}
