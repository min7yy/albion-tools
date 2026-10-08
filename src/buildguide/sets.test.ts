import { describe, expect, it } from 'vitest'
import type { MetaSummary } from '../meta/aggregate'
import { usualGear } from './sets'
import type { Weapon } from './weapons'

const sword: Weapon = { base: 'MAIN_SWORD', name: 'Broadsword', sub: 'sword', twoHanded: false }
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

  it('takes the most worn known item per slot, with no off-hand for two-handed weapons', () => {
    expect(usualGear(claymore, summary).map((g) => g.base)).toEqual(['HEAD_PLATE_SET1', 'ARMOR_PLATE_SET1', 'SHOES_LEATHER_SET1', 'CAPE'])
  })

  it("fills a weapon's empty slots with the most common item overall", () => {
    expect(usualGear(sword, summary).map((g) => g.base)).toEqual(['OFF_SHIELD', 'HEAD_PLATE_SET1', 'ARMOR_PLATE_SET1', 'SHOES_LEATHER_SET1', 'CAPE'])
  })
})
