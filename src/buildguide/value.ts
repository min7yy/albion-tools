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
  /** Extra item power by tier, e.g. the mastery modifier's share of spec. */
  tierBonus: (tier: number) => number = () => 0,
): WeaponOption[] {
  const options: WeaponOption[] = []
  for (const [tier, ench, basePower] of weapon.variants) {
    const itemId = weaponItemId(weapon.base, tier, ench)
    for (const quality of QUALITIES) {
      const offer = cheapestOffer(itemId, quality, prices, settings)
      const itemPower = basePower + QUALITY_ITEM_POWER[quality] + tierBonus(tier)
      if (offer) options.push({ ...offer, itemId, tier, ench, quality, itemPower })
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
