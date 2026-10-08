import { describe, expect, it } from 'vitest'
import { guideFor, summarize } from './guide'
import type { WeaponRow } from './loadouts'
import { WEAPONS } from './weapons'

const bow = WEAPONS.find((w) => w.base === '2H_BOW')!
const row = (bySize: WeaponRow['bySize']): WeaponRow => ({
  weapon: bow, wins: 0, losses: 0, fights: 0, winRate: 0, itemPower: null, bySize, best: null, brackets: [],
})

describe('summarize', () => {
  it('keeps whole sentences and skips bare lead-ins', () => {
    expect(summarize('Condition:\nActivates when you drink a potion. Then something else happens later on.')).toBe(
      'Condition: Activates when you drink a potion. Then something else happens later on.',
    )
    expect(summarize('Deals 50 damage to every enemy in a long line in front of you. Slows them.')).toBe(
      'Deals 50 damage to every enemy in a long line in front of you.',
    )
  })
})

describe('guideFor', () => {
  it('says where the weapon wins, from fight sizes with enough fights', () => {
    const g = guideFor(row({ s: [30, 10], m: [10, 30], l: [1, 0] }), null)
    expect(g.lines[0]).toBe('DPS weapon that does best in solo fights (75% over 40) and worst in small-group (2–5) ones (25% over 40).')
  })

  it('recommends a skill per key only with community picks from two or more builds', () => {
    const none = guideFor(row({ s: [0, 0], m: [0, 0], l: [0, 0] }), null)
    // E has a single option, so it needs no pick.
    expect(none.pieces[0].skills.map((s) => s.spell.id)).toEqual(['SPEEDARCHER_KITE'])
    expect(none.pieces[0].open.map((o) => o.key)).toEqual(['Q', 'W', 'P'])
    const community = { updatedAt: '', builds: 3, items: { '2H_BOW': [3, { MULTISHOT2: 3, POISONARROW: 1 }] as [number, Record<string, number>] } }
    const picked = guideFor(row({ s: [0, 0], m: [0, 0], l: [0, 0] }), community)
    expect(picked.pieces[0].skills.map((s) => s.spell.id)).toEqual(['MULTISHOT2', 'SPEEDARCHER_KITE'])
    expect(picked.lines).toContain('Your damage comes from Multishot (Q).')
  })
})
