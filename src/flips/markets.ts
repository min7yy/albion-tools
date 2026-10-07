import { MARKET_CITIES } from '../api/cities'
import { BLACK_MARKET } from './flips'

/** Every market the flip finder compares: the royal cities, Caerleon, Brecilien and the Black Market. */
export const FLIP_MARKETS: string[] = [...MARKET_CITIES, BLACK_MARKET]

/** The Black Market only buys gear, so resource flips skip it. */
export function flipMarketsFor(category: string): string[] {
  return category === 'resources' ? FLIP_MARKETS.filter((m) => m !== BLACK_MARKET) : FLIP_MARKETS
}
