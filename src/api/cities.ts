export const ROYAL_CITIES = [
  'Bridgewatch',
  'Fort Sterling',
  'Lymhurst',
  'Martlock',
  'Thetford',
] as const

export const MARKET_CITIES = [...ROYAL_CITIES, 'Caerleon', 'Brecilien'] as const

export type MarketCity = (typeof MARKET_CITIES)[number]
