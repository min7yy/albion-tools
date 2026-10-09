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

const TYPE_LABELS: Record<string, string> = {
  arcanestaff: 'Arcane staffs',
  axe: 'Axes',
  bow: 'Bows',
  crossbow: 'Crossbows',
  cursestaff: 'Cursed staffs',
  dagger: 'Daggers',
  firestaff: 'Fire staffs',
  froststaff: 'Frost staffs',
  hammer: 'Hammers',
  holystaff: 'Holy staffs',
  knuckles: 'War gloves',
  mace: 'Maces',
  naturestaff: 'Nature staffs',
  quarterstaff: 'Quarterstaffs',
  shapeshifterstaff: 'Shapeshifter staffs',
  spear: 'Spears',
  sword: 'Swords',
}

export function weaponTypeLabel(sub: string): string {
  return TYPE_LABELS[sub] ?? sub
}

/** Weapon types in the data, sorted by label. */
export const WEAPON_TYPES: string[] = [...new Set(WEAPONS.map((w) => w.sub))].sort((a, b) =>
  weaponTypeLabel(a).localeCompare(weaponTypeLabel(b)),
)

export type Role = 'tank' | 'healer' | 'dps' | 'support'

export const ROLES: { id: Role; label: string }[] = [
  { id: 'tank', label: 'Tank' },
  { id: 'healer', label: 'Healer' },
  { id: 'dps', label: 'DPS' },
  { id: 'support', label: 'Support' },
]

/**
 * The role a weapon type usually fills in group content. The game files don't tag roles, so this is the
 * community's usual split (as on build sites), with the exceptions below.
 */
const ROLE_BY_TYPE: Record<string, Role> = {
  mace: 'tank',
  hammer: 'tank',
  quarterstaff: 'tank',
  holystaff: 'healer',
  naturestaff: 'healer',
  arcanestaff: 'support',
}

/** Weapons that play a different role from the rest of their type. */
const ROLE_BY_WEAPON: Record<string, Role> = {
  // Damage quarterstaffs.
  '2H_DOUBLEBLADEDSTAFF': 'dps',
  '2H_DOUBLEBLADEDSTAFF_CRYSTAL': 'dps',
  '2H_TWINSCYTHE_HELL': 'dps',
  // Shapeshifters that tank or support rather than deal damage.
  '2H_SHAPESHIFTER_SET2': 'tank',
  '2H_SHAPESHIFTER_KEEPER': 'tank',
  '2H_SHAPESHIFTER_AVALON': 'support',
  // Debuff and utility staffs.
  MAIN_CURSEDSTAFF_CRYSTAL: 'support',
  '2H_ICEGAUNTLETS_HELL': 'support',
}

export function weaponRole(w: Pick<Weapon, 'base' | 'sub'>): Role {
  return ROLE_BY_WEAPON[w.base] ?? ROLE_BY_TYPE[w.sub] ?? 'dps'
}
