import { ROYAL_CITIES } from '../api/cities'
import { BLACK_MARKET } from '../crafting/evaluate'

/** Cities you can craft in (and buy materials from). */
export const CRAFTING_CITIES: string[] = [...ROYAL_CITIES, 'Caerleon']
/** Every market the crafting page reads prices from. */
export const CRAFTING_MARKETS: string[] = [...CRAFTING_CITIES, BLACK_MARKET]
