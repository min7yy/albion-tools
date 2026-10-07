import { WEAPONS } from './weapons'

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
