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
}

const typed = data as unknown as { source: string; weapons: Weapon[] }

export const WEAPONS: Weapon[] = typed.weapons

