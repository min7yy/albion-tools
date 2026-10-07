import { describe, expect, it } from 'vitest'
import type { MetaSummary } from '../meta/aggregate'
import { isCommonGear, usualGear } from './sets'
import type { Weapon } from './weapons'

const sword: Weapon = { base: 'MAIN_SWORD', name: 'Broadsword', sub: 'sword', twoHanded: false, variants: [] }
const claymore: Weapon = { ...sword, base: '2H_CLAYMORE', name: 'Claymore', twoHanded: true }

describe('usualGear', () => {
  const summary: MetaSummary = {
    server: 'europe',
    updatedAt: '',
    from: '',
    to: '',
    events: 1,
    weapons: {
      '2H_CLAYMORE': {
        stats: {},
        gear: {
          OffHand: [['OFF_SHIELD', 9]],
          Head: [['NOT_A_REAL_ITEM', 9], ['HEAD_PLATE_SET1', 3]],
          Armor: [['ARMOR_PLATE_SET1', 5]],
        },
      },
    },
  }

  it('tries the usual items first, then common ones, with no off-hand for two-handed weapons', () => {
    const slots = usualGear(claymore, summary).map((slot) => slot.map((g) => g.base))
    expect(slots.length).toBe(4)
    expect(slots[0][0]).toBe('HEAD_PLATE_SET1')
    expect(slots[1][0]).toBe('ARMOR_PLATE_SET1')
    expect(slots[3]).toEqual(['CAPE'])
  })

  it('fills every slot even for a weapon with no kills', () => {
    const slots = usualGear(sword, summary).map((slot) => slot.map((g) => g.base))
    expect(slots.length).toBe(5)
    expect(slots[0]).toEqual(['OFF_SHIELD', 'OFF_TORCH'])
    expect(slots.every((s) => s.length > 0)).toBe(true)
  })

  it('leaves artifacts out of the substitutes', () => {
    expect(isCommonGear('OFF_HORN_KEEPER')).toBe(false)
    expect(isCommonGear('CAPEITEM_FW_MARTLOCK')).toBe(false)
    expect(isCommonGear('HEAD_CLOTH_SET1')).toBe(true)
  })
})
