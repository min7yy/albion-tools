import { describe, expect, it } from 'vitest'
import { browsePlan, marketCategory } from './browsePlan'
import type { Gear } from './gear'
import type { Weapon } from './weapons'

const bow = (base: string, name: string): Weapon => ({ base, name, sub: 'bow', twoHanded: true, variants: [] })
const gear = (base: string, name: string, slot: Gear['slot'], sub: string): Gear => ({ base, name, slot, sub, variants: [] })

describe('browsePlan', () => {
  it('names market categories the way the game does', () => {
    expect(marketCategory(bow('2H_WARBOW', 'Warbow'))).toBe('Bows')
    expect(marketCategory(gear('HEAD_LEATHER_SET1', 'Mercenary Hood', 'Head', 'leather_helmet'))).toBe('Leather helmets')
    expect(marketCategory(gear('CAPE_UNDEAD', 'Undead Cape', 'Cape', 'other'))).toBe('Capes')
  })

  it('groups pieces into one page per category and city, biggest first', () => {
    const plan = browsePlan([
      { city: 'Lymhurst', item: bow('2H_WARBOW', 'Warbow'), tier: 6, ench: 1 },
      { city: 'Lymhurst', item: bow('2H_LONGBOW', 'Longbow'), tier: 5, ench: 0 },
      { city: 'Lymhurst', item: gear('CAPE', 'Cape', 'Cape', 'accessoires_capes_capes'), tier: 4, ench: 2 },
      { city: 'Bridgewatch', item: bow('2H_WARBOW', 'Warbow'), tier: 6, ench: 1 },
    ])
    expect([...plan.keys()]).toEqual(['Bridgewatch', 'Lymhurst'])
    expect(plan.get('Lymhurst')).toEqual([
      { category: 'Bows', tiers: ['T5.0', 'T6.1'], items: ['Longbow', 'Warbow'] },
      { category: 'Capes', tiers: ['T4.2'], items: ['Cape'] },
    ])
  })
})
