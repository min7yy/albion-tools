import data from '../data/weapons.json'

/** One weapon line as stored in src/data/weapons.json (see scripts/build-weapon-data.mjs). */
export interface Weapon {
  /** Item id without tier, e.g. 2H_CLAYMORE_AVALON. */
  base: string
  /** English name without the tier prefix, e.g. "Kingmaker". */
  name: string
  /** Weapon type, e.g. "sword" or "firestaff". */
  sub: string
  twoHanded: boolean
  /** [tier, enchantment, item power at normal quality] for every version on the market. */
  variants: [number, number, number][]
}

const typed = data as unknown as { source: string; weapons: Weapon[] }

export const WEAPONS: Weapon[] = typed.weapons

/** AODP item id for a weapon at a tier and enchantment, e.g. T6_2H_CLAYMORE_AVALON@2. */
export function weaponItemId(base: string, tier: number, ench: number): string {
  return ench ? `T${tier}_${base}@${ench}` : `T${tier}_${base}`
}
