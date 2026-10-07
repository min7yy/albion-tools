import type { ResourceKind } from '../api/items'
import type { MarketCity } from '../api/cities'
import {
  BASE_CITY_BONUS,
  FOCUS_BONUS,
  returnRateForBonus,
  stationFeeForValue,
  type TradeSettings,
} from '../profit'

export type { TradeMode } from '../profit'
export { BASE_CITY_BONUS, FOCUS_BONUS } from '../profit'

export interface RefiningSettings extends TradeSettings {
  /** Refine with focus (adds a large production bonus). */
  useFocus: boolean
  /** Station usage fee in silver per 100 nutrition, as shown at the station. */
  stationFeePer100: number
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

/** Extra bonus in the city that specialises in refining this resource. */
export const SPECIALTY_BONUS = 40

export const REFINING_SPECIALTY: Record<ResourceKind, MarketCity> = {
  ore: 'Thetford',
  hide: 'Martlock',
  fiber: 'Lymhurst',
  wood: 'Fort Sterling',
  stone: 'Bridgewatch',
}

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
  return returnRateForBonus(bonus)
}

/**
 * Item value used for station fees. Resources double in value per tier (T4 = 16)
 * and per enchantment level. Nutrition used per craft is 11.25% of the item value.
 */
export function itemValue(tier: number, enchantment: number): number {
  return 2 ** tier * 2 ** enchantment
}

export function stationFee(tier: number, enchantment: number, feePer100: number): number {
  return stationFeeForValue(itemValue(tier, enchantment), feePer100)
}
