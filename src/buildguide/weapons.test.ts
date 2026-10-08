import { describe, expect, it } from 'vitest'
import { WEAPONS, weaponItemId } from './weapons'

describe('weapon data', () => {
  it('builds market ids with the enchantment suffix', () => {
    expect(weaponItemId('MAIN_SWORD', 4, 0)).toBe('T4_MAIN_SWORD')
    expect(weaponItemId('2H_CLAYMORE_AVALON', 6, 2)).toBe('T6_2H_CLAYMORE_AVALON@2')
  })

  it('ships item power for every weapon type', () => {
    const broadsword = WEAPONS.find((w) => w.base === 'MAIN_SWORD')
    expect(broadsword?.name).toBe('Broadsword')
    // A 4.4 has the same item power as a 7.1 and an 8.0.
    const ip = (t: number, e: number) => broadsword?.variants.find(([tier, ench]) => tier === t && ench === e)?.[2]
    expect(ip(4, 4)).toBe(ip(7, 1))
    expect(ip(8, 0)).toBe(ip(7, 1))
    expect(new Set(WEAPONS.map((w) => w.sub))).toContain('shapeshifterstaff')
  })
})
