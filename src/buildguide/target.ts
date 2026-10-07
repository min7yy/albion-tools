import type { Gear } from './gear'
import { specItemPower, type SetSlot } from './mastery'
import { valueFrontier, weaponOptions, type OfferSettings, type QualityPriceLookup, type WeaponOption } from './value'
import type { Weapon } from './weapons'
import type { GearSlot } from '../meta/aggregate'

export interface SetPiece {
  slot: SetSlot
  base: string
  name: string
  /** Versions worth buying in one city, cheapest first; item power includes spec. */
  frontier: WeaponOption[]
  /** 0 for the item most often seen with the weapon, 1 for the next most common, and so on. */
  rank: number
}

export interface TargetSet {
  /** Every piece is bought here. */
  city: string
  picks: { piece: SetPiece; option: WeaponOption }[]
  price: number
  /** Average over six slots as the game counts it: a two-handed weapon fills the off-hand too. */
  itemPower: number
}

/** Slots in the game's average: main hand, off-hand, helmet, armour, shoes and cape. */
const SLOTS = 6

/**
 * Version frontiers for a weapon and its gear in one city. Each slot uses the most common item
 * the city sells; a slot where it sells none of them comes back with no versions.
 */
export function cityPieces(
  weapon: Weapon,
  gear: Gear[][],
  prices: QualityPriceLookup,
  settings: OfferSettings,
  spec: number,
): SetPiece[] {
  const piece = (slot: SetSlot, item: Weapon | Gear, rank: number): SetPiece => ({
    slot,
    base: item.base,
    name: item.name,
    frontier: valueFrontier(weaponOptions(item, prices, settings, (tier) => specItemPower(tier, slot, spec))),
    rank,
  })
  const slots = gear.map((choices) => {
    const pieces = choices.map((g, rank) => piece(g.slot, g, rank))
    return pieces.find((p) => p.frontier.length > 0) ?? pieces[0]
  })
  return [piece('MainHand', weapon, 0), ...slots]
}

interface Combo {
  price: number
  /** Item power summed over the six slots. */
  power: number
  pick: { index: number; prev: Combo['pick'] } | null
}

/**
 * Cheapest set in one city whose average item power reaches the target. Exact: combines slots
 * one at a time, keeping only combinations with more item power than every cheaper one.
 * Returns null when a slot can't be bought there or the target is out of reach.
 */
export function cheapestForTarget(
  weapon: Weapon,
  city: string,
  allPieces: SetPiece[],
  target: number,
  /** Least item power each piece may have, so no slot is left far behind the rest. */
  floor: (slot: SetSlot) => number = () => 0,
): TargetSet | null {
  const pieces = allPieces.map((p) => ({ ...p, frontier: p.frontier.filter((o) => o.itemPower >= floor(p.slot)) }))
  const slotsFilled = pieces.length + (weapon.twoHanded ? 1 : 0)
  if (slotsFilled < SLOTS || pieces.some((p) => !p.frontier.length)) return null
  const needed = target * SLOTS
  const weightOf = (p: SetPiece) => (p.slot === 'MainHand' && weapon.twoHanded ? 2 : 1)
  // Most item power the slots after each one can still add, to drop combinations that can't make it.
  const rest = pieces.map((_, i) =>
    pieces.slice(i + 1).reduce((sum, p) => sum + p.frontier[p.frontier.length - 1].itemPower * weightOf(p), 0),
  )
  let front: Combo[] = [{ price: 0, power: 0, pick: null }]
  pieces.forEach((piece, i) => {
    const weight = weightOf(piece)
    // Cheapest combination per item power; anything past the target counts as the target.
    const byPower = new Map<number, Combo>()
    for (const c of front) {
      piece.frontier.forEach((o, index) => {
        const power = Math.min(needed, c.power + o.itemPower * weight)
        if (power + rest[i] < needed) return
        const price = c.price + o.price
        const held = byPower.get(power)
        if (!held || price < held.price) byPower.set(power, { price, power, pick: { index, prev: c.pick } })
      })
    }
    // Keep only combinations with more item power than every cheaper one.
    const sorted = [...byPower.values()].sort((a, b) => a.price - b.price || b.power - a.power)
    front = []
    for (const c of sorted) if (!front.length || c.power > front[front.length - 1].power) front.push(c)
  })
  const best = front.find((c) => c.power >= needed)
  if (!best) return null
  const at: number[] = []
  for (let p = best.pick; p; p = p.prev) at.unshift(p.index)
  return {
    city,
    picks: pieces.map((piece, i) => ({ piece, option: piece.frontier[at[i]] })),
    price: best.price,
    itemPower: Math.floor(
      pieces.reduce((sum, piece, i) => sum + piece.frontier[at[i]].itemPower * weightOf(piece), 0) / SLOTS,
    ),
  }
}

/**
 * How pieces rise with the target: 'even' keeps every piece near it, 'weapon' puts the weapon at
 * the target and lets armour trail a little, 'cheapest' takes any mix that reaches the average.
 */
export type Climb = 'even' | 'weapon' | 'cheapest'

/** How far below the target a piece may sit, by climb. */
export const CLIMB_GAP: Record<Climb, number> = { even: 100, weapon: 150, cheapest: Infinity }

/**
 * Least item power a piece may have. Capes get no spec, so they trail the others by up to the
 * spec bonus with its T8 tier bonus (+20%), and their floor drops by that much.
 */
export function pieceFloor(slot: SetSlot, target: number, spec: number, climb: Climb): number {
  if (climb === 'cheapest') return 0
  if (climb === 'weapon' && slot === 'MainHand') return target
  return target - CLIMB_GAP[climb] - (slot === 'Cape' ? Math.round(spec * 1.2) : 0)
}

/** Cheapest city for the target: every piece from one market, nobody wants five trips for one set. */
export function cheapestCity(
  weapon: Weapon,
  gear: Gear[][],
  prices: QualityPriceLookup,
  settings: OfferSettings,
  spec: number,
  target: number,
  climb: Climb = 'cheapest',
): TargetSet | null {
  let best: TargetSet | null = null
  const floor = (slot: SetSlot) => pieceFloor(slot, target, spec, climb)
  for (const city of settings.cities) {
    const set = cheapestForTarget(weapon, city, cityPieces(weapon, gear, prices, { ...settings, cities: [city] }, spec), target, floor)
    if (set && (!best || set.price < best.price)) best = set
  }
  return best
}

/** Why a weapon has no set, in a few words, for the list under the results. */
export function noSetReason(
  weapon: Weapon,
  gear: Gear[][],
  prices: QualityPriceLookup,
  settings: OfferSettings,
  spec: number,
): string {
  const anywhere = cityPieces(weapon, gear, prices, settings, spec)
  const missing = anywhere.find((p) => !p.frontier.length)
  if (missing) return missing.slot === 'MainHand' ? 'not for sale with recent prices' : `no ${SLOT_NAMES[missing.slot]} for sale with recent prices`
  const complete = settings.cities.some((city) =>
    cityPieces(weapon, gear, prices, { ...settings, cities: [city] }, spec).every((p) => p.frontier.length),
  )
  return complete ? 'target out of reach' : 'no single city sells every piece'
}

const SLOT_NAMES: Record<SetSlot, string> = {
  MainHand: 'weapon',
  OffHand: 'off-hand',
  Head: 'helmet',
  Armor: 'armour',
  Shoes: 'shoes',
  Cape: 'cape',
}

/** Item power above the pick that still counts as the same step. */
const LADDER_SPREAD = 25
/** The cheapest few are what matter. */
const LADDER_ROWS = 6

export interface LadderRow {
  tier: number
  ench: number
  quality: number
  itemPower: number
  /** Cities whose price is last week's average sale rather than a sell order. */
  averaged: Set<string>
  /** Price per city; missing where nobody sells it. */
  prices: Map<string, number>
}

/**
 * The cheapest versions of an item with the same item power as the one picked: 8.0, 7.1, 6.2,
 * 5.3 and 4.4 share base item power, and quality can stand in for part of a step. Spec is
 * included, so a higher tier can edge ahead.
 */
export function equivalenceLadder(
  item: Pick<Weapon, 'base' | 'variants'>,
  slot: SetSlot,
  itemPower: number,
  prices: QualityPriceLookup,
  settings: OfferSettings,
  spec: number,
): LadderRow[] {
  const rows = new Map<string, LadderRow>()
  for (const city of settings.cities) {
    for (const o of weaponOptions(item, prices, { ...settings, cities: [city] }, (tier) => specItemPower(tier, slot, spec))) {
      // Same item power or a little above (spec's tier bonus moves versions apart by a few points).
      if (o.itemPower < itemPower || o.itemPower >= itemPower + LADDER_SPREAD) continue
      const key = `${o.tier}.${o.ench}.${o.quality}`
      const row = rows.get(key) ?? {
        tier: o.tier,
        ench: o.ench,
        quality: o.quality,
        itemPower: o.itemPower,
        prices: new Map(),
        averaged: new Set<string>(),
      }
      row.prices.set(city, o.price)
      if (o.average) row.averaged.add(city)
      rows.set(key, row)
    }
  }
  const cheapest = (r: LadderRow) => Math.min(...r.prices.values())
  return [...rows.values()].sort((a, b) => cheapest(a) - cheapest(b) || a.itemPower - b.itemPower).slice(0, LADDER_ROWS)
}

export type { GearSlot }
