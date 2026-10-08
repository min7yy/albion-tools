import { describe, expect, it } from 'vitest'
import { SEEN_IDS, addEvents, emptyState, fightSize, isWeapon, itemBase, pruneState, summarize, type KillEvent } from './aggregate'

function player(id: string, main: string | null, gear: Record<string, string> = {}) {
  const equipment: Record<string, { Type: string } | null> = { MainHand: main ? { Type: main } : null }
  for (const [slot, type] of Object.entries(gear)) equipment[slot] = { Type: type }
  return { Id: id, Equipment: equipment }
}

function kill(id: number, time: string, attackers: KillEvent['Killer'][], victim: KillEvent['Victim']): KillEvent {
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
  it('splits each kill between its attackers and gives the victim a death', () => {
    const state = emptyState()
    const ally = player('b', 'T6_2H_HOLYSTAFF')
    expect(addEvents(state, [kill(10, '2026-10-07T09:00:00Z', [fire, ally], sickle)])).toBe(1)
    const day = state.days['2026-10-07']
    expect(day.weapons.MAIN_FIRESTAFF).toEqual({ m: [0.5, 0] })
    expect(day.weapons['2H_HOLYSTAFF']).toEqual({ m: [0.5, 0] })
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

  it('counts kills the feed lists late, below ids already seen', () => {
    const state = emptyState()
    addEvents(state, [kill(20, '2026-10-07T09:00:00Z', [fire], sickle)])
    expect(addEvents(state, [kill(19, '2026-10-07T08:59:00Z', [fire], sickle)])).toBe(1)
    expect(addEvents(state, [kill(19, '2026-10-07T08:59:00Z', [fire], sickle)])).toBe(0)
    expect(state.lastEventId).toBe(20)
  })

  it('remembers only the newest SEEN_IDS ids', () => {
    const state = emptyState()
    const events = Array.from({ length: SEEN_IDS + 5 }, (_, i) => kill(i + 1, '2026-10-07T09:00:00Z', [fire], sickle))
    addEvents(state, events)
    expect(state.seenIds!.length).toBe(SEEN_IDS)
    expect(state.seenIds![0]).toBe(6)
    expect(addEvents(state, [events[SEEN_IDS + 4]])).toBe(0)
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
      kill(1, '2026-09-05T09:00:00Z', [fire], sickle),
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

describe('item power', () => {
  it('records each player under their fight size and item power step', () => {
    const state = emptyState()
    const strong = { ...fire, AverageItemPower: 1187.4 }
    const weak = { ...sickle, AverageItemPower: 912 }
    addEvents(state, [kill(20, '2026-10-07T09:00:00Z', [strong], weak)])
    expect(state.days['2026-10-07'].weapons).toEqual({ MAIN_FIRESTAFF: { s1100: [1, 0] }, '2H_DUALSICKLE_UNDEAD': { s900: [0, 1] } })
  })
})

describe('extra kill stats', () => {
  const event = (): KillEvent => {
    const attacker = { ...player('a', 'T4_MAIN_FIRESTAFF', { Potion: 'T6_POTION_HEAL@1', Food: 'T8_MEAL_STEW' }), AverageItemPower: 1250 }
    const healer = player('b', 'T6_2H_HOLYSTAFF')
    return kill(20, '2026-10-08T09:00:00Z', [attacker, healer], { ...sickle, AverageItemPower: 1050 })
  }

  it('records consumables', () => {
    const state = emptyState()
    addEvents(state, [event()])
    const day = state.days['2026-10-08']
    expect(day.gear.MAIN_FIRESTAFF.Potion).toEqual({ POTION_HEAL: 1 })
    expect(day.gear.MAIN_FIRESTAFF.Food).toEqual({ MEAL_STEW: 1 })
  })


  it('summarises them with a daily trend', () => {
    const state = emptyState()
    addEvents(state, [kill(5, '2026-10-07T09:00:00Z', [fire], sickle), event()])
    const summary = summarize(state, 'asia', new Date('2026-10-08T12:00:00Z'))
    expect(summary.dates).toEqual(['2026-10-07', '2026-10-08'])
    const w = summary.weapons.MAIN_FIRESTAFF
    // The second kill had two attackers, so the fire staff gets half of it.
    expect(w.trend).toEqual([[1, 0], [0.5, 0]])
    expect(w.gear.Potion).toEqual([['POTION_HEAL', 1]])
    expect(summary.weapons['2H_HOLYSTAFF'].trend).toEqual([[0, 0], [0.5, 0]])
  })

  it('keeps the top loadouts of every item power bracket', () => {
    const state = emptyState()
    const events: KillEvent[] = []
    // 14 popular low-IP loadouts, then one rare high-IP loadout that would miss the overall top 12.
    for (let i = 0; i < 14; i++) {
      for (let n = 0; n < 3; n++) {
        const p = { ...player(`p${i}-${n}`, 'T4_MAIN_FIRESTAFF', { Cape: `T4_CAPE${i}` }), AverageItemPower: 900 }
        events.push(kill(100 + i * 10 + n, '2026-10-08T09:00:00Z', [p], sickle))
      }
    }
    const rare = { ...player('r', 'T4_MAIN_FIRESTAFF', { Cape: 'T8_CAPERARE' }), AverageItemPower: 1450 }
    events.push(kill(999, '2026-10-08T09:00:00Z', [rare], sickle))
    addEvents(state, events)
    const builds = summarize(state, 'asia', new Date('2026-10-08T12:00:00Z')).weapons.MAIN_FIRESTAFF.builds!
    expect(builds.some(([bases]) => bases[4] === 'CAPERARE')).toBe(true)
    expect(builds.length).toBe(13)
  })
})

describe('looking back', () => {
  it('sums the last week, and goes further back for weapons with few fights', () => {
    const state = emptyState()
    const events: KillEvent[] = []
    let id = 1
    // 120 sword kills a day for the last 7 days; one fire staff kill 12 days ago and one today.
    for (let d = 1; d <= 7; d++)
      for (let n = 0; n < 120; n++)
        events.push(kill(id++, `2026-10-${String(d + 1).padStart(2, '0')}T09:00:00Z`, [player(`s${id}`, 'T4_MAIN_SWORD')], sickle))
    events.push(kill(id++, '2026-09-26T09:00:00Z', [fire], sickle))
    events.push(kill(id++, '2026-10-08T09:00:00Z', [fire], sickle))
    events.push(kill(id++, '2026-09-20T09:00:00Z', [player('old', 'T4_MAIN_SWORD')], sickle))
    addEvents(state, events)
    const now = new Date('2026-10-08T12:00:00Z')
    pruneState(state, now)
    const summary = summarize(state, 'asia', now)
    expect(summary).toMatchObject({ from: '2026-10-02', to: '2026-10-08' })
    // The sword has plenty in the week, so it stops there.
    expect(summary.weapons.MAIN_SWORD.stats.s).toEqual([840, 0])
    expect(summary.weapons.MAIN_SWORD.from).toBeUndefined()
    // The fire staff looks back through the kept 28 days, dated from its oldest kill.
    expect(summary.weapons.MAIN_FIRESTAFF).toMatchObject({ from: '2026-09-26', stats: { s: [2, 0] } })
    expect(summary.weapons.MAIN_FIRESTAFF.trend).toHaveLength(7)
  })
})

describe('split kills', () => {
  it('rounds the shares to three decimals when pruning', () => {
    const state = emptyState()
    addEvents(state, [kill(1, '2026-10-07T09:00:00Z', [fire, player('b', 'T4_MAIN_FIRESTAFF'), player('c', 'T4_MAIN_FIRESTAFF')], sickle)])
    pruneState(state, new Date('2026-10-07T12:00:00Z'))
    expect(state.days['2026-10-07'].weapons.MAIN_FIRESTAFF.m).toEqual([1, 0])
    addEvents(state, [kill(2, '2026-10-07T10:00:00Z', [fire, player('d', 'T4_2H_HOLYSTAFF'), player('e', 'T4_2H_HOLYSTAFF')], sickle)])
    pruneState(state, new Date('2026-10-07T12:00:00Z'))
    expect(state.days['2026-10-07'].weapons.MAIN_FIRESTAFF.m).toEqual([1.333, 0])
  })
})
