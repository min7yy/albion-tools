import { describe, expect, it } from 'vitest'
import { communityBuilds, spellOptions } from './spells'

describe('spellOptions', () => {
  it("groups a weapon's skills by key with the game's descriptions", () => {
    const groups = spellOptions('2H_BOW', null)
    expect(groups.map((g) => g.key)).toEqual(['Q', 'W', 'E', 'P'])
    const deadly = groups[0].options.find((o) => o.spell.id === 'DEADLYSHOT')!
    expect(deadly.spell).toMatchObject({ name: 'Deadly Shot', cd: 2, energy: 3 })
    expect(deadly.spell.desc).toContain('physical damage')
    expect(deadly.picked).toBeNull()
  })

  it('orders options by how often community builds pick them', () => {
    const community = { updatedAt: '', builds: 4, items: { '2H_BOW': [4, { DEADLYSHOT: 1, MULTISHOT2: 3 }] as [number, Record<string, number>] } }
    const q = spellOptions('2H_BOW', community)[0].options
    expect(q.map((o) => [o.spell.id, o.picked])).toEqual([
      ['MULTISHOT2', 0.75],
      ['DEADLYSHOT', 0.25],
      ['POISONARROW', 0],
    ])
    expect(communityBuilds('2H_BOW', community)).toBe(4)
    expect(communityBuilds('MAIN_SWORD', community)).toBe(0)
  })

  it('knows armour and cape skills', () => {
    expect(spellOptions('ARMOR_PLATE_SET1', null).map((g) => g.key)).toEqual(['R', 'P'])
    expect(spellOptions('CAPEITEM_FW_MARTLOCK', null)[0].options[0].spell.name).toBe('Shield of Protection')
  })
})
