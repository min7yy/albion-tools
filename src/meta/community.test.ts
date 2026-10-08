import { describe, expect, it } from 'vitest'
import { countPicks } from './community'

const build = (votes: number, spells: string[]) => ({
  netVotes: votes,
  slots: [
    { slotType: 'mainhand', mainItemSelection: { itemUniqueName: 'T6_2H_BOW@1', selectedSpells: spells.map((uniqueName) => ({ uniqueName })) } },
    { slotType: 'potion', mainItemSelection: { itemUniqueName: 'T7_POTION_REVIVE', selectedSpells: [] } },
  ],
})

describe('countPicks', () => {
  it('counts each build once per spell and skips builds voted below zero', () => {
    const picks = countPicks(
      [build(3, ['MULTISHOT2', 'SPEEDARCHER_KITE']), build(0, ['DEADLYSHOT', 'SPEEDARCHER_KITE', 'SPEEDARCHER_KITE']), build(-2, ['DEADLYSHOT'])],
      new Date('2026-10-08T00:00:00Z'),
    )
    expect(picks.builds).toBe(2)
    expect(picks.items['2H_BOW']).toEqual([2, { MULTISHOT2: 1, SPEEDARCHER_KITE: 2, DEADLYSHOT: 1 }])
    expect(picks.items.POTION_REVIVE).toEqual([2, {}])
  })
})
