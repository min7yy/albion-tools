import { describe, expect, it } from 'vitest'
import type { Price } from '../api/prices'
import type { Gear } from './gear'
import { masteryModifier, specFromLevels, specItemPower } from './mastery'
import { cheapestCity, cheapestForTarget, equivalenceLadder, noSetReason, type SetPiece } from './target'
import { indexQualityPrices, type WeaponOption } from './value'
import type { Weapon } from './weapons'

const claymore: Weapon = { base: '2H_CLAYMORE', name: 'Claymore', sub: 'sword', twoHanded: true, variants: [] }

function opt(itemPower: number, price: number): WeaponOption {
  return { itemId: `X${itemPower}`, tier: 4, ench: 0, quality: 1, itemPower, price, city: 'Martlock', date: new Date() }
}
function piece(slot: SetPiece['slot'], ...options: WeaponOption[]): SetPiece {
  return { slot, base: slot, name: slot, frontier: options, rank: 0 }
}

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

describe('cheapestForTarget', () => {
  // Two-handed: weapon counts twice, so five pieces fill the six slots.
  const pieces = [
    piece('MainHand', opt(700, 1000), opt(800, 3000)),
    piece('Head', opt(700, 100), opt(800, 500)),
    piece('Armor', opt(700, 100), opt(800, 900)),
    piece('Shoes', opt(700, 100), opt(800, 400)),
    piece('Cape', opt(700, 100)),
  ]

  it('finds the cheapest set whose average reaches the target', () => {
    expect(cheapestForTarget(claymore, 'Martlock', pieces, 700)).toMatchObject({ price: 1400, itemPower: 700 })
    const set = cheapestForTarget(claymore, 'Martlock', pieces, 733)!
    // Needs +200 summed: head (+100, 400) and shoes (+100, 300) = 700 extra beats the weapon (2,000).
    expect(set.picks.map((p) => p.option.itemPower)).toEqual([700, 800, 700, 800, 700])
    expect(set).toMatchObject({ city: 'Martlock', price: 2100, itemPower: 733 })
  })

  it('returns nothing when the target is out of reach or a slot has no prices', () => {
    expect(cheapestForTarget(claymore, 'Martlock', pieces, 900)).toBeNull()
    expect(cheapestForTarget(claymore, 'Martlock', [...pieces.slice(0, 4), piece('Cape')], 700)).toBeNull()
    expect(cheapestForTarget(claymore, 'Martlock', pieces.slice(0, 4), 700)).toBeNull()
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

describe('cheapestCity and equivalenceLadder', () => {
  const weapon: Weapon = { ...claymore, variants: [[4, 0, 700], [4, 4, 1100], [8, 0, 1100]] }
  const gear = (slot: Gear['slot'], base: string): Gear[] => [{ base, name: base, slot, variants: [[4, 0, 700]] }]
  const gearSlots = [gear('Head', 'HEAD_X'), gear('Armor', 'ARMOR_X'), gear('Shoes', 'SHOES_X'), gear('Cape', 'CAPE_X')]
  const rows: Price[] = []
  for (const city of settings.cities) for (const g of ['HEAD_X', 'ARMOR_X', 'SHOES_X', 'CAPE_X']) rows.push(price(`T4_${g}`, city, 100))
  rows.push(price('T4_2H_CLAYMORE', 'Martlock', 1000), price('T4_2H_CLAYMORE@4', 'Martlock', 9000))
  rows.push(price('T8_2H_CLAYMORE', 'Lymhurst', 8000))
  const lookup = indexQualityPrices(rows)

  it('buys the whole set in the cheapest city that reaches the target', () => {
    // Weapon at 1100 lifts the average to (2×1100 + 4×700) / 6 = 833.
    const set = cheapestCity(weapon, gearSlots, lookup, settings, 0, 830)!
    expect(set).toMatchObject({ city: 'Lymhurst', price: 8400, itemPower: 833 })
    expect(set.picks.every((p) => p.option.city === 'Lymhurst')).toBe(true)
  })

  it('counts spec with the tier bonus', () => {
    // With 100 spec the T8 weapon gets 120 and the T4 armour 100; the cape gets none.
    const set = cheapestCity(weapon, gearSlots, lookup, settings, 100, 900)!
    expect(set.picks[0].option).toMatchObject({ tier: 8, itemPower: 1220 })
    expect(set.picks.find((p) => p.piece.slot === 'Cape')?.option.itemPower).toBe(700)
  })

  it('says why a weapon has no set', () => {
    expect(noSetReason(weapon, gearSlots, lookup, settings, 0)).toBe('target out of reach')
    const noCape = [...gearSlots.slice(0, 3), gear('Cape', 'CAPE_Y')]
    expect(noSetReason(weapon, noCape, lookup, settings, 0)).toBe('no cape for sale with recent prices')
    const split = indexQualityPrices(rows.filter((r) => !(r.itemId === 'T4_CAPE_X' && r.city === 'Lymhurst')).filter((r) => r.city === 'Lymhurst' || r.itemId !== 'T4_HEAD_X'))
    expect(noSetReason({ ...weapon, variants: [[8, 0, 1100]] }, gearSlots, split, settings, 0)).toBe('no single city sells every piece')
  })

  it('lists equivalent versions per city', () => {
    const ladder = equivalenceLadder(weapon, 'MainHand', 1100, lookup, settings, 0)
    expect(ladder.map((r) => [r.tier, r.ench, Object.fromEntries(r.prices)])).toEqual([
      [8, 0, { Lymhurst: 8000 }],
      [4, 4, { Martlock: 9000 }],
    ])
  })
})
