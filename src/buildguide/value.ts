import type { Price } from '../api/prices'
import { weaponItemId, type Weapon } from './weapons'

/** Market qualities: 1 Normal, 2 Good, 3 Outstanding, 4 Excellent, 5 Masterpiece. */
export const QUALITIES = [1, 2, 3, 4, 5] as const
export const QUALITY_NAMES = ['', 'Normal', 'Good', 'Outstanding', 'Excellent', 'Masterpiece']
/** Item power each quality adds on top of the item's base item power. */
export const QUALITY_ITEM_POWER = [0, 0, 20, 40, 60, 100]

export type QualityPriceLookup = (itemId: string, city: string, quality: number) => Price | undefined

/** Prices keyed by item, city and quality (the shared indexPrices drops quality). */
export function indexQualityPrices(prices: Price[]): QualityPriceLookup {
  const map = new Map(prices.map((p) => [`${p.itemId}|${p.city}|${p.quality}`, p]))
  return (itemId, city, quality) => map.get(`${itemId}|${city}|${quality}`)
}

export interface OfferSettings {
  /** Cities to buy in. */
  cities: readonly string[]
  /** Sell orders older than this are ignored, since the item has probably sold. */
  maxAgeHours: number
  now: number
}

export interface Offer {
  price: number
  city: string
  date: Date
}

/** Cheapest fresh sell order for an item at one quality across the given cities. */
export function cheapestOffer(itemId: string, quality: number, prices: QualityPriceLookup, settings: OfferSettings): Offer | null {
  const cutoff = settings.now - settings.maxAgeHours * 3600_000
  let best: Offer | null = null
  for (const city of settings.cities) {
    const p = prices(itemId, city, quality)
    if (!p?.sellMin || !p.sellMinDate || p.sellMinDate.getTime() < cutoff) continue
    if (!best || p.sellMin < best.price) best = { price: p.sellMin, city, date: p.sellMinDate }
  }
  return best
}

export interface WeaponOption extends Offer {
  itemId: string
  tier: number
  ench: number
  quality: number
  itemPower: number
}

/** Every version (tier, enchantment, quality) of a weapon or piece of gear that has a fresh price. */
export function weaponOptions(
  weapon: Pick<Weapon, 'base' | 'variants'>,
  prices: QualityPriceLookup,
  settings: OfferSettings,
): WeaponOption[] {
  const options: WeaponOption[] = []
  for (const [tier, ench, basePower] of weapon.variants) {
    const itemId = weaponItemId(weapon.base, tier, ench)
    for (const quality of QUALITIES) {
      const offer = cheapestOffer(itemId, quality, prices, settings)
      if (offer) options.push({ ...offer, itemId, tier, ench, quality, itemPower: basePower + QUALITY_ITEM_POWER[quality] })
    }
  }
  return options
}

/**
 * The versions worth buying: sorted by price, each one has more item power than every
 * cheaper version. Anything else costs more for the same or less item power.
 */
export function valueFrontier(options: WeaponOption[]): WeaponOption[] {
  const sorted = [...options].sort((a, b) => a.price - b.price || b.itemPower - a.itemPower)
  const frontier: WeaponOption[] = []
  for (const o of sorted) {
    if (!frontier.length || o.itemPower > frontier[frontier.length - 1].itemPower) frontier.push(o)
  }
  return frontier
}

/** Highest item power at or under the budget; the cheapest one when several tie. */
export function bestUnderBudget(frontier: WeaponOption[], budget: number): WeaponOption | null {
  let best: WeaponOption | null = null
  for (const o of frontier) {
    if (o.price > budget) break
    best = o
  }
  return best
}

export interface WeaponValue {
  weapon: Weapon
  frontier: WeaponOption[]
}

/** Value frontier for each weapon; weapons with no fresh prices are left out. */
export function evaluateWeapons(weapons: Weapon[], prices: QualityPriceLookup, settings: OfferSettings): WeaponValue[] {
  return weapons
    .map((weapon) => ({ weapon, frontier: valueFrontier(weaponOptions(weapon, prices, settings)) }))
    .filter((v) => v.frontier.length > 0)
}

export interface BudgetRow {
  weapon: Weapon
  best: WeaponOption
  frontier: WeaponOption[]
}

/** Best version of each weapon under the budget, highest item power first, then cheapest. */
export function rankForBudget(values: WeaponValue[], budget: number): BudgetRow[] {
  const rows: BudgetRow[] = []
  for (const v of values) {
    const best = bestUnderBudget(v.frontier, budget)
    if (best) rows.push({ weapon: v.weapon, best, frontier: v.frontier })
  }
  return rows.sort((a, b) => b.best.itemPower - a.best.itemPower || a.best.price - b.best.price || a.weapon.name.localeCompare(b.weapon.name))
}

/** Cheapest and dearest prices on any frontier, for the budget slider's range. */
export function budgetRange(values: WeaponValue[]): { min: number; max: number } | null {
  let min = Infinity
  let max = 0
  for (const v of values) {
    for (const o of v.frontier) {
      min = Math.min(min, o.price)
      max = Math.max(max, o.price)
    }
  }
  return max ? { min, max } : null
}
