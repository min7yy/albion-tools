import { describe, expect, it } from 'vitest'
import { ROLES, WEAPONS, weaponRole } from './weapons'

describe('weapon data', () => {
  it('ships every weapon type with names', () => {
    expect(WEAPONS.find((w) => w.base === 'MAIN_SWORD')).toMatchObject({ name: 'Broadsword', sub: 'sword', twoHanded: false })
    expect(new Set(WEAPONS.map((w) => w.sub))).toContain('shapeshifterstaff')
  })
})

const role = (base: string) => weaponRole(WEAPONS.find((w) => w.base === base)!)

describe('weaponRole', () => {
  it('uses the type for most weapons and the exceptions for the rest', () => {
    expect(role('2H_HAMMER')).toBe('tank')
    expect(role('MAIN_HOLYSTAFF')).toBe('healer')
    expect(role('2H_CROSSBOW')).toBe('dps')
    expect(role('MAIN_ARCANESTAFF')).toBe('support')
    expect(role('2H_TWINSCYTHE_HELL')).toBe('dps')
    expect(role('2H_SHAPESHIFTER_SET2')).toBe('tank')
  })

  it('gives every role some weapons', () => {
    for (const r of ROLES) expect(WEAPONS.some((w) => weaponRole(w) === r.id)).toBe(true)
  })
})
