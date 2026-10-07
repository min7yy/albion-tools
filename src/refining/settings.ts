import type { ResourceKind } from '../api/items'
import type { MarketCity } from '../api/cities'

export type TradeMode = 'instant' | 'order'

export interface RefiningSettings {
  /** Refine with focus (adds a large production bonus). */
  useFocus: boolean
  /** Premium halves the sales tax (4% instead of 8%). */
  premium: boolean
  /** Station usage fee in silver per 100 nutrition, as shown at the station. */
  stationFeePer100: number
  /** instant: buy from the cheapest sell order. order: place a buy order at the top buy price. */
  buyMode: TradeMode
  /** instant: sell to the top buy order. order: list a sell order at the cheapest sell price. */
  sellMode: TradeMode
  /** Use this return rate (0–1) instead of the computed one. null = computed. */
  returnRateOverride: number | null
}

export const DEFAULT_SETTINGS: RefiningSettings = {
  useFocus: false,
  premium: true,
  stationFeePer100: 300,
  buyMode: 'instant',
  sellMode: 'order',
  returnRateOverride: null,
}

/** Production bonus (in %) every royal city gives for refining. */
export const BASE_CITY_BONUS = 18
/** Extra bonus in the city that specialises in refining this resource. */
export const SPECIALTY_BONUS = 40
export const FOCUS_BONUS = 59

export const REFINING_SPECIALTY: Record<ResourceKind, MarketCity> = {
  ore: 'Thetford',
  hide: 'Martlock',
  fiber: 'Lymhurst',
  wood: 'Fort Sterling',
  stone: 'Bridgewatch',
}

export const SALES_TAX_PREMIUM = 0.04
export const SALES_TAX_NO_PREMIUM = 0.08
/** Charged when placing a buy or sell order, on top of sales tax. */
export const ORDER_SETUP_FEE = 0.025

/**
 * Resource return rate for refining in a city: 1 - 1 / (1 + bonus / 100).
 * Gives 15.25% base, 36.7% in the specialty city, 43.5% with focus and 53.9% with both.
 * Only royal cities have the base bonus; elsewhere the rate is 0 without focus.
 */
export function returnRate(resource: ResourceKind, city: string, useFocus: boolean): number {
  const isRoyal = Object.values(REFINING_SPECIALTY).includes(city as MarketCity)
  let bonus = isRoyal ? BASE_CITY_BONUS : 0
  if (REFINING_SPECIALTY[resource] === city) bonus += SPECIALTY_BONUS
  if (useFocus) bonus += FOCUS_BONUS
  return 1 - 1 / (1 + bonus / 100)
}

/**
 * Item value used for station fees. Resources double in value per tier (T4 = 16)
 * and per enchantment level. Nutrition used per craft is 11.25% of the item value.
 */
export function itemValue(tier: number, enchantment: number): number {
  return 2 ** tier * 2 ** enchantment
}

export function stationFee(tier: number, enchantment: number, feePer100: number): number {
  const nutrition = itemValue(tier, enchantment) * 0.1125
  return (nutrition * feePer100) / 100
}
