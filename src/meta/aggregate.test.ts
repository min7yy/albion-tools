import { describe, expect, it } from 'vitest'
import { addEvents, emptyState, fightSize, isWeapon, itemBase, pruneState, summarize, type KillEvent } from './aggregate'

function player(id: string, main: string | null, gear: Record<string, string> = {}) {
  const equipment: Record<string, { Type: string } | null> = { MainHand: main ? { Type: main } : null }
  for (const [slot, type] of Object.entries(gear)) equipment[slot] = { Type: type }
  return { Id: id, Equipment: equipment }
}

function kill(id: number, time: string, attackers: ReturnType<typeof player>[], victim: ReturnType<typeof player>): KillEvent {
  return {
    EventId: id,
    TimeStamp: time,
    numberOfParticipants: attackers.length,
    Killer: attackers[0],
    Victim: victim,
    Participants: attackers,
  }
}

const fire = player('a', 'T4_MAIN_FIRESTAFF@2', { OffHand: 'T4_OFF_HORN_KEEPER@2', Armor: 'T4_ARMOR_CLOTH_SET2@2', Head: 'T4_HEAD_LEATHER_SET2' })
const sickle = player('v', 'T5_2H_DUALSICKLE_UNDEAD@3', { Armor: 'T7_ARMOR_CLOTH_SET2@1' })

describe('helpers', () => {
  it('strips tier and enchantment', () => {
    expect(itemBase('T6_2H_CLAYMORE_AVALON@2')).toBe('2H_CLAYMORE_AVALON')
    expect(itemBase('T4_MAIN_SWORD')).toBe('MAIN_SWORD')
  })
  it('buckets fight sizes', () => {
    expect([1, 2, 5, 6, 40].map(fightSize)).toEqual(['s', 'm', 'm', 'l', 'l'])
  })
  it('ignores gathering tools', () => {
    expect(isWeapon('2H_TOOL_PICK')).toBe(false)
    expect(isWeapon('MAIN_FIRESTAFF')).toBe(true)
  })
})

describe('addEvents', () => {
  it('counts kills for every attacker and a death for the victim', () => {
    const state = emptyState()
    const ally = player('b', 'T6_2H_HOLYSTAFF')
    expect(addEvents(state, [kill(10, '2026-10-07T09:00:00Z', [fire, ally], sickle)])).toBe(1)
    const day = state.days['2026-10-07']
    expect(day.weapons.MAIN_FIRESTAFF).toEqual({ m: [1, 0] })
    expect(day.weapons['2H_HOLYSTAFF']).toEqual({ m: [1, 0] })
    expect(day.weapons['2H_DUALSICKLE_UNDEAD']).toEqual({ m: [0, 1] })
    expect(day.gear.MAIN_FIRESTAFF.OffHand).toEqual({ OFF_HORN_KEEPER: 1 })
    expect(state.lastEventId).toBe(10)
  })

  it('skips events already counted and counts each attacker once', () => {
    const state = emptyState()
    addEvents(state, [kill(10, '2026-10-07T09:00:00Z', [fire], sickle)])
    addEvents(state, [kill(10, '2026-10-07T09:00:00Z', [fire], sickle), kill(11, '2026-10-07T09:01:00Z', [fire, fire], sickle)])
    expect(state.days['2026-10-07'].events).toBe(2)
    expect(state.days['2026-10-07'].weapons.MAIN_FIRESTAFF.s).toEqual([1, 0])
    expect(state.days['2026-10-07'].weapons.MAIN_FIRESTAFF.m).toEqual([1, 0])
  })

  it('keeps counting older pages within one run', () => {
    const state = emptyState()
    addEvents(state, [kill(20, '2026-10-07T09:00:00Z', [fire], sickle)], 0)
    expect(addEvents(state, [kill(19, '2026-10-07T08:59:00Z', [fire], sickle)], 0)).toBe(1)
    expect(state.lastEventId).toBe(20)
  })

  it('skips players with no weapon', () => {
    const state = emptyState()
    addEvents(state, [kill(1, '2026-10-07T09:00:00Z', [fire], player('n', null))])
    expect(Object.keys(state.days['2026-10-07'].weapons)).toEqual(['MAIN_FIRESTAFF'])
  })
})

describe('pruneState and summarize', () => {
  it('drops days older than the window and sums the rest', () => {
    const state = emptyState()
    addEvents(state, [
      kill(1, '2026-09-20T09:00:00Z', [fire], sickle),
      kill(2, '2026-10-06T09:00:00Z', [fire], sickle),
      kill(3, '2026-10-07T09:00:00Z', [fire], sickle),
    ])
    const now = new Date('2026-10-07T12:00:00Z')
    pruneState(state, now)
    expect(Object.keys(state.days).sort()).toEqual(['2026-10-06', '2026-10-07'])
    const summary = summarize(state, 'europe', now)
    expect(summary).toMatchObject({ server: 'europe', from: '2026-10-06', to: '2026-10-07', events: 2 })
    expect(summary.weapons.MAIN_FIRESTAFF.stats).toEqual({ s: [2, 0] })
    expect(summary.weapons.MAIN_FIRESTAFF.gear.Armor).toEqual([['ARMOR_CLOTH_SET2', 2]])
  })

  it('keeps only the most common gear per weapon', () => {
    const state = emptyState()
    const events = Array.from({ length: 30 }, (_, i) =>
      kill(i + 1, '2026-10-07T09:00:00Z', [player(`p${i}`, 'T4_MAIN_SWORD', { Cape: `T4_CAPEITEM_${i % 25}` })], sickle),
    )
    addEvents(state, events)
    pruneState(state, new Date('2026-10-07T12:00:00Z'))
    expect(Object.keys(state.days['2026-10-07'].gear.MAIN_SWORD.Cape ?? {})).toHaveLength(20)
    const summary = summarize(state, 'asia', new Date('2026-10-07T12:00:00Z'))
    expect(summary.weapons.MAIN_SWORD.gear.Cape).toHaveLength(5)
    expect(summary.weapons.MAIN_SWORD.gear.Cape?.[0][1]).toBe(2)
  })
})

describe('loadouts', () => {
  it('records whole loadouts with wins and losses and sums them into the summary', () => {
    const state = emptyState()
    addEvents(state, [kill(10, '2026-10-06T09:00:00Z', [fire], sickle), kill(11, '2026-10-07T09:00:00Z', [sickle], fire)])
    expect(state.days['2026-10-06'].builds?.MAIN_FIRESTAFF).toEqual({
      'OFF_HORN_KEEPER|HEAD_LEATHER_SET2|ARMOR_CLOTH_SET2||': { s: [1, 0] },
    })
    const summary = summarize(state, 'asia', new Date('2026-10-07T12:00:00Z'))
    expect(summary.weapons.MAIN_FIRESTAFF.builds).toEqual([
      [['OFF_HORN_KEEPER', 'HEAD_LEATHER_SET2', 'ARMOR_CLOTH_SET2', '', ''], { s: [1, 1] }],
    ])
    expect(summary.weapons['2H_DUALSICKLE_UNDEAD'].builds?.[0][0]).toEqual(['', '', 'ARMOR_CLOTH_SET2', '', ''])
  })

  it('reads days recorded before loadouts were tracked', () => {
    const state = emptyState()
    state.days['2026-10-07'] = { events: 1, weapons: { MAIN_SWORD: { s: [1, 0] } }, gear: {} }
    pruneState(state, new Date('2026-10-07T12:00:00Z'))
    expect(summarize(state, 'asia', new Date('2026-10-07T12:00:00Z')).weapons.MAIN_SWORD.builds).toBeUndefined()
  })
})
