import { describe, expect, it } from 'vitest'
import type { Price } from '../api/prices'
import type { Gear } from './gear'
import { masteryModifier, specFromLevels, specItemPower } from './mastery'
import { BAND, bandOptions, buildSet, equivalenceLadder, noSetReason, slotCentre } from './target'
import { indexQualityPrices } from './value'
import type { Weapon } from './weapons'

describe('mastery', () => {
  it('adds 5% of spec per tier above T4, except on capes', () => {
    expect(masteryModifier(8, 'MainHand')).toBeCloseTo(0.2)
    expect(masteryModifier(8, 'Cape')).toBe(0)
    expect(specItemPower(8, 'Armor', 100)).toBe(120)
    expect(specItemPower(4, 'Armor', 100)).toBe(100)
    expect(specItemPower(8, 'Cape', 100)).toBe(0)
  })

  it('turns destiny board levels into item power', () => {
    expect(specFromLevels(100, 50)).toBe(120)
    expect(specFromLevels(0, 0)).toBe(0)
  })
})

const date = new Date('2026-10-07T12:00:00Z')
const price = (itemId: string, city: string, sellMin: number, quality = 1): Price => ({
  itemId,
  city,
  quality,
  sellMin,
  sellMinDate: date,
  buyMax: null,
  buyMaxDate: null,
})
const settings = { cities: ['Martlock', 'Lymhurst'], maxAgeHours: 24, now: date.getTime() }
const tiers: Weapon['variants'] = [
  [4, 0, 700],
  [5, 0, 800],
  [6, 0, 900],
  [8, 3, 1400],
]
const weapon: Weapon = { base: '2H_CLAYMORE', name: 'Claymore', sub: 'sword', twoHanded: true, variants: tiers }
const gear = (slot: Gear['slot'], base: string): Gear => ({ base, name: base, slot, variants: tiers })
const gearSlots = [[gear('Head', 'HEAD_X')], [gear('Armor', 'ARMOR_X')], [gear('Shoes', 'SHOES_X')], [gear('Cape', 'CAPE_X')]]
const id = (base: string, tier: number, ench = 0) => `T${tier}_${base}${ench ? `@${ench}` : ''}`

describe('slotCentre', () => {
  it('puts capes lower by the spec they miss and lifts the rest so the average stays on target', () => {
    expect(slotCentre('Head', 1100, 0)).toBe(1100)
    expect(slotCentre('Head', 1100, 120)).toBe(1122)
    expect(slotCentre('Cape', 1100, 120)).toBe(990)
    expect((5 * slotCentre('Armor', 1100, 120) + slotCentre('Cape', 1100, 120)) / 6).toBe(1100)
  })
})

describe('buildSet', () => {
  // Every piece at T4 is dirt cheap, every piece at T5 a bit more, and an 8.3 helmet is on sale too.
  const rows: Price[] = []
  for (const city of settings.cities) {
    for (const base of ['2H_CLAYMORE', 'HEAD_X', 'ARMOR_X', 'SHOES_X', 'CAPE_X']) {
      rows.push(price(id(base, 4), city, 100), price(id(base, 5), city, 1000))
    }
    rows.push(price(id('HEAD_X', 8, 3), city, 50))
  }
  const lookup = indexQualityPrices(rows)

  it('keeps every piece within the band of the target, however cheap other tiers are', () => {
    const set = buildSet(weapon, gearSlots, lookup, settings, 0, 800)!
    expect(set.picks.map((p) => p.option.tier)).toEqual([5, 5, 5, 5, 5])
    expect(set.picks.every((p) => Math.abs(p.option.itemPower - 800) <= BAND)).toBe(true)
    expect(set).toMatchObject({ itemPower: 800, price: 5000 })
  })

  it('lifts the cheapest pieces within the band until the average reaches the target', () => {
    const better = [...rows]
    for (const city of settings.cities) {
      better.push(price(id('2H_CLAYMORE', 5), city, 5000, 3))
      for (const base of ['HEAD_X', 'ARMOR_X', 'SHOES_X']) better.push(price(id(base, 5), city, 1100, 3))
    }
    // 800 is 20 short of 820 on average: three +40 pieces at 100 each beat the +80 weapon at 4,000.
    const set = buildSet(weapon, gearSlots, indexQualityPrices(better), settings, 0, 820)!
    expect(set.picks.map((p) => p.option.quality)).toEqual([1, 3, 3, 3, 1])
    expect(set.itemPower).toBe(820)
  })

  it('buys in the city that sells the most pieces and fills the rest elsewhere', () => {
    const partial = indexQualityPrices(rows.filter((r) => !(r.city === 'Martlock' && r.itemId === 'T5_SHOES_X')).filter((r) => !(r.city === 'Lymhurst' && r.itemId === 'T5_HEAD_X')).filter((r) => !(r.city === 'Lymhurst' && r.itemId === 'T5_ARMOR_X')))
    const set = buildSet(weapon, gearSlots, partial, settings, 0, 800)!
    expect(set.city).toBe('Martlock')
    expect(set.picks.find((p) => p.slot === 'Shoes')?.option.city).toBe('Lymhurst')
    expect(set.picks.filter((p) => p.option.city === 'Martlock')).toHaveLength(4)
  })

  it('falls back to the next most common item in a slot', () => {
    const set = buildSet(weapon, [[gear('Head', 'HEAD_Y'), gear('Head', 'HEAD_X')], ...gearSlots.slice(1)], lookup, settings, 0, 800)!
    expect(set.picks.find((p) => p.slot === 'Head')).toMatchObject({ rank: 1, item: { base: 'HEAD_X' } })
  })

  it('counts spec with the tier bonus and leaves capes without it', () => {
    // 100 spec: T5 pieces get +105, so 905 sits near a 900 target; the T5 cape gets none and sits at 800.
    const set = buildSet(weapon, gearSlots, lookup, settings, 100, 900)!
    expect(set.picks.find((p) => p.slot === 'Armor')?.option.itemPower).toBe(905)
    expect(set.picks.find((p) => p.slot === 'Cape')?.option.itemPower).toBe(800)
  })

  it('says which slot has nothing near the target', () => {
    expect(buildSet(weapon, gearSlots, lookup, settings, 0, 1100)).toBeNull()
    expect(noSetReason(weapon, gearSlots, lookup, settings, 0, 1100)).toBe('no weapon near 1100 IP for sale with recent prices')
    expect(noSetReason(weapon, gearSlots.slice(0, 2), lookup, settings, 0, 800)).toBe('no gear data yet')
  })
})

describe('bandOptions and equivalenceLadder', () => {
  const rows = [
    price(id('2H_CLAYMORE', 5), 'Martlock', 3000),
    price(id('2H_CLAYMORE', 4), 'Lymhurst', 2000, 5), // Masterpiece T4: 800 IP
    price(id('2H_CLAYMORE', 4), 'Lymhurst', 100), // 700 IP, too low
    price(id('2H_CLAYMORE', 6), 'Lymhurst', 50), // 900 IP, too high
  ]
  const lookup = indexQualityPrices(rows)

  it('only offers versions inside the band, cheapest first', () => {
    expect(bandOptions(weapon, 'MainHand', 800, lookup, settings, 0).map((o) => [o.tier, o.quality, o.price])).toEqual([
      [4, 5, 2000],
      [5, 1, 3000],
    ])
  })

  it('lists equivalent versions per city', () => {
    const ladder = equivalenceLadder(weapon, 'MainHand', 800, lookup, settings, 0)
    expect(ladder.map((r) => [r.tier, r.quality, Object.fromEntries(r.prices)])).toEqual([
      [4, 5, { Lymhurst: 2000 }],
      [5, 1, { Martlock: 3000 }],
    ])
  })
})
