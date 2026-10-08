import { describe, expect, it } from 'vitest'
import { countPicks } from './community'

const build = (votes: number, spells: string[], updatedAt = '2026-09-01T00:00:00Z') => ({
  netVotes: votes,
  updatedAt,
  slots: [
    { slotType: 'mainhand', mainItemSelection: { itemUniqueName: 'T6_2H_BOW@1', selectedSpells: spells.map((uniqueName) => ({ uniqueName })) } },
    { slotType: 'potion', mainItemSelection: { itemUniqueName: 'T7_POTION_REVIVE', selectedSpells: [] } },
  ],
})

describe('countPicks', () => {
  it('counts each upvoted, recent build once per spell', () => {
    const picks = countPicks(
      [
        build(3, ['MULTISHOT2', 'SPEEDARCHER_KITE']),
        build(1, ['DEADLYSHOT', 'SPEEDARCHER_KITE', 'SPEEDARCHER_KITE']),
        // No votes, voted down, and last edited over a year ago: all left out.
        build(0, ['DEADLYSHOT']),
        build(-2, ['DEADLYSHOT']),
        build(5, ['DEADLYSHOT'], '2025-09-01T00:00:00Z'),
      ],
      new Date('2026-10-08T00:00:00Z'),
    )
    expect(picks.builds).toBe(2)
    expect(picks.items['2H_BOW']).toEqual([2, { MULTISHOT2: 1, SPEEDARCHER_KITE: 2, DEADLYSHOT: 1 }])
    expect(picks.items.POTION_REVIVE).toEqual([2, {}])
    expect(picks.consumables!['2H_BOW']).toEqual({ builds: 2, Potion: { POTION_REVIVE: 2 }, Food: {} })
  })
})
