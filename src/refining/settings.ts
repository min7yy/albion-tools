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
  /** Percent your specialisation cuts focus cost by (0 = untrained). */
  focusCostReduction: number
}

export const DEFAULT_SETTINGS: RefiningSettings = {
  useFocus: false,
  premium: true,
  stationFeePer100: 300,
  buyMode: 'instant',
  sellMode: 'order',
  returnRateOverride: null,
  focusCostReduction: 0,
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

/**
 * Base focus per refine, from the game data (ao-bin-dumps items.json). Every resource
 * uses the same table, and each enchantment level costs the same as one tier up,
 * so the index is tier + enchantment - 2.
 */
const BASE_FOCUS = [18, 31, 54, 94, 164, 287, 503, 880, 1539, 2694, 4714]

export function focusCost(tier: number, enchantment: number, reductionPercent = 0): number {
  const base = BASE_FOCUS[tier + enchantment - 2]
  if (base === undefined) throw new Error(`No focus cost for T${tier}.${enchantment}`)
  return base * (1 - Math.min(100, Math.max(0, reductionPercent)) / 100)
}
