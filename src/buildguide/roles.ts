import type { Weapon } from './weapons'

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
