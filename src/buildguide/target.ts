import type { Gear } from './gear'
import { specItemPower, type SetSlot } from './mastery'
import { weaponOptions, type Offer, type OfferSettings, type QualityPriceLookup, type WeaponOption } from './value'
import type { Weapon } from './weapons'
import type { GearSlot } from '../meta/aggregate'

/**
 * How a set is built: every piece is a version whose item power sits within BAND of its slot's
 * centre, so all pieces sit at about the same level, picked as cheaply as possible while the
 * average still reaches the target. Pieces come from one city where possible; any it doesn't sell come from the cheapest
 * other city and are marked.
 */
export const BAND = 50

/** Slots in the game's average: main hand, off-hand, helmet, armour, shoes and cape. */
const SLOTS = 6

/**
 * Item power a piece should have. Capes get no spec, so they sit below the others by roughly the
 * spec bonus (with an average tier bonus of +10%), and the rest sit a little above the target to
 * make up for it: with every other piece at X and the cape at X − s, the average is X − s/6.
 */
export function slotCentre(slot: SetSlot, target: number, spec: number): number {
  const capeLag = Math.round(spec * 1.1)
  return slot === 'Cape' ? target - Math.round((capeLag * 5) / 6) : target + Math.round(capeLag / 6)
}

export interface SetPick {
  slot: SetSlot
  item: Weapon | Gear
  /** 0 for the item most often seen with the weapon in this slot, 1 for the next, and so on. */
  rank: number
  /** The version bought; its city is where to buy it. */
  option: WeaponOption
}

export interface TargetSet {
  /** Where most of the set is bought; pieces whose option.city differs come from elsewhere. */
  city: string
  picks: SetPick[]
  price: number
  /** Average over six slots as the game counts it: a two-handed weapon fills the off-hand too. */
  itemPower: number
}

/** Versions of an item within the band for its slot in the given cities, cheapest first. */
export function bandOptions(
  item: Pick<Weapon, 'base' | 'variants'>,
  slot: SetSlot,
  target: number,
  prices: QualityPriceLookup,
  settings: OfferSettings,
  spec: number,
): WeaponOption[] {
  const centre = slotCentre(slot, target, spec)
  return weaponOptions(item, prices, settings, (tier) => specItemPower(tier, slot, spec))
    .filter((o) => Math.abs(o.itemPower - centre) <= BAND)
    .sort((a, b) => a.price - b.price || Math.abs(a.itemPower - centre) - Math.abs(b.itemPower - centre))
}

/** The slots to fill: the weapon, then each gear slot with its items in order of preference. */
function slotChoices(weapon: Weapon, gear: Gear[][]): { slot: SetSlot; items: (Weapon | Gear)[] }[] {
  return [{ slot: 'MainHand', items: [weapon] }, ...gear.filter((g) => g.length).map((g) => ({ slot: g[0].slot, items: g }))]
}

/** A slot's choice: the first item in order of preference with anything in the band, and its versions. */
interface SlotChoice {
  slot: SetSlot
  item: Weapon | Gear
  rank: number
  /** Versions within the band, cheapest first. */
  options: WeaponOption[]
}

function slotChoice(
  slot: SetSlot,
  items: (Weapon | Gear)[],
  target: number,
  prices: QualityPriceLookup,
  settings: OfferSettings,
  spec: number,
): SlotChoice | null {
  for (const [rank, item] of items.entries()) {
    const options = bandOptions(item, slot, target, prices, settings, spec)
    if (options.length) return { slot, item, rank, options }
  }
  return null
}

/**
 * Starts every slot on its cheapest version in the band, then, while the average is short of the
 * target, swaps in whichever higher version costs least per item power gained.
 */
function reachTarget(choices: SlotChoice[], weight: (slot: SetSlot) => number, target: number): SetPick[] {
  const picks: SetPick[] = choices.map(({ slot, item, rank, options }) => ({ slot, item, rank, option: options[0] }))
  const total = () => picks.reduce((sum, p) => sum + p.option.itemPower * weight(p.slot), 0)
  for (let deficit = target * SLOTS - total(); deficit > 0; deficit = target * SLOTS - total()) {
    let best: { i: number; option: WeaponOption; cost: number } | null = null
    for (const [i, choice] of choices.entries()) {
      const current = picks[i].option
      for (const option of choice.options) {
        const gain = (option.itemPower - current.itemPower) * weight(choice.slot)
        if (gain <= 0) continue
        const cost = (option.price - current.price) / Math.min(gain, deficit)
        if (!best || cost < best.cost) best = { i, option, cost }
      }
    }
    if (!best) break
    picks[best.i] = { ...picks[best.i], option: best.option }
  }
  return picks
}

/**
 * The set for a weapon at a target average item power: the city that sells the most pieces
 * (cheapest on a tie), with anything it lacks bought in the cheapest other city. Null when some
 * slot has nothing near the target anywhere; noSetReason says which.
 */
export function buildSet(
  weapon: Weapon,
  gear: Gear[][],
  prices: QualityPriceLookup,
  settings: OfferSettings,
  spec: number,
  target: number,
): TargetSet | null {
  const slots = slotChoices(weapon, gear)
  if (slots.length + (weapon.twoHanded ? 1 : 0) < SLOTS) return null
  let best: { city: string; choices: (SlotChoice | null)[]; found: number; price: number } | null = null
  for (const city of settings.cities) {
    const choices = slots.map((s) => slotChoice(s.slot, s.items, target, prices, { ...settings, cities: [city] }, spec))
    const found = choices.filter(Boolean).length
    const price = choices.reduce((sum, c) => sum + (c?.options[0].price ?? 0), 0)
    if (!best || found > best.found || (found === best.found && price < best.price)) best = { city, choices, found, price }
  }
  if (!best) return null
  const choices: SlotChoice[] = []
  for (const [i, choice] of best.choices.entries()) {
    const filled = choice ?? slotChoice(slots[i].slot, slots[i].items, target, prices, settings, spec)
    if (!filled) return null
    choices.push(filled)
  }
  const weight = (slot: SetSlot) => (slot === 'MainHand' && weapon.twoHanded ? 2 : 1)
  const picks = reachTarget(choices, weight, target)
  return {
    city: best.city,
    picks,
    price: picks.reduce((sum, p) => sum + p.option.price, 0),
    itemPower: Math.floor(picks.reduce((sum, p) => sum + p.option.itemPower * weight(p.slot), 0) / SLOTS),
  }
}

const SLOT_NAMES: Record<SetSlot, string> = {
  MainHand: 'weapon',
  OffHand: 'off-hand',
  Head: 'helmet',
  Armor: 'armour',
  Shoes: 'shoes',
  Cape: 'cape',
}

/** Why a weapon has no set, in a few words, for its card. */
export function noSetReason(
  weapon: Weapon,
  gear: Gear[][],
  prices: QualityPriceLookup,
  settings: OfferSettings,
  spec: number,
  target: number,
): string {
  const slots = slotChoices(weapon, gear)
  if (slots.length + (weapon.twoHanded ? 1 : 0) < SLOTS) return 'no gear data yet'
  const missing = slots.find((s) => !slotChoice(s.slot, s.items, target, prices, settings, spec))
  return missing ? `no ${SLOT_NAMES[missing.slot]} near ${target} IP for sale with recent prices` : 'no prices'
}

/** The cheapest few versions are what matter. */
const LADDER_ROWS = 6

export interface LadderRow {
  tier: number
  ench: number
  quality: number
  itemPower: number
  /** The offer per city (price, and whether it is an average or an archived order); missing where nobody sells it. */
  offers: Map<string, Offer>
}

/** Every version of a piece within the band, with its price in each city, cheapest first. */
export function equivalenceLadder(
  item: Pick<Weapon, 'base' | 'variants'>,
  slot: SetSlot,
  target: number,
  prices: QualityPriceLookup,
  settings: OfferSettings,
  spec: number,
): LadderRow[] {
  const rows = new Map<string, LadderRow>()
  for (const city of settings.cities) {
    for (const o of bandOptions(item, slot, target, prices, { ...settings, cities: [city] }, spec)) {
      const key = `${o.tier}.${o.ench}.${o.quality}`
      const row = rows.get(key) ?? {
        tier: o.tier,
        ench: o.ench,
        quality: o.quality,
        itemPower: o.itemPower,
        offers: new Map(),
      }
      row.offers.set(city, o)
      rows.set(key, row)
    }
  }
  const cheapest = (r: LadderRow) => Math.min(...[...r.offers.values()].map((o) => o.price))
  return [...rows.values()].sort((a, b) => cheapest(a) - cheapest(b) || a.itemPower - b.itemPower).slice(0, LADDER_ROWS)
}

export type { GearSlot }
