import { describe, expect, it } from 'vitest'
import type { MetaSummary } from '../meta/aggregate'
import { bestSet, bestSetAnyCity, cheapestSet, dearestSet, homeAndBest, planSet, planSets, usualGear, type SetPiece } from './sets'
import { indexQualityPrices } from './value'
import type { Price } from '../api/prices'
import type { WeaponOption } from './value'
import type { Weapon } from './weapons'

const sword: Weapon = { base: 'MAIN_SWORD', name: 'Broadsword', sub: 'sword', twoHanded: false, variants: [] }
const claymore: Weapon = { ...sword, base: '2H_CLAYMORE', name: 'Claymore', twoHanded: true }

function opt(itemPower: number, price: number): WeaponOption {
  return { itemId: `X${itemPower}`, tier: 4, ench: 0, quality: 1, itemPower, price, city: 'Martlock', date: new Date() }
}
function piece(slot: SetPiece['slot'], ...options: WeaponOption[]): SetPiece {
  return { slot, base: slot, name: slot, frontier: options, rank: 0 }
}

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

  it('lists known items per slot, most common first, with no off-hand for two-handed weapons', () => {
    expect(usualGear(claymore, summary).map((slot) => slot.map((g) => [g.slot, g.base]))).toEqual([
      [['Head', 'HEAD_PLATE_SET1']],
      [['Armor', 'ARMOR_PLATE_SET1']],
    ])
    expect(usualGear(sword, summary)).toEqual([])
  })
})

describe('planSet and bestSet', () => {
  const pieces = [
    piece('MainHand', opt(800, 1000), opt(900, 2000), opt(1200, 20_000)),
    piece('Head', opt(800, 500), opt(1000, 1500)),
    piece('Armor', opt(800, 500), opt(900, 4000)),
    piece('Cape'),
  ]
  const plan = planSet(sword, 'Martlock', pieces)

  it('returns nothing when even the cheapest set is over budget', () => {
    expect(bestSet(plan, 1999)).toBeNull()
  })

  it('finds the strongest combination for the budget', () => {
    // 3,000 buys one upgrade: weapon +100 IP (+8.3% damage) beats helmet +200 IP (~+4.0%).
    const set = bestSet(plan, 3000)
    expect(set?.picks.map((p) => p.option.itemPower)).toEqual([900, 800, 800])
    expect(set).toMatchObject({ city: 'Martlock', price: 3000, itemPower: 833, missing: ['Cape'] })
    expect(set!.strength).toBeCloseTo(1.0825, 3)
    // 4,000 buys both.
    expect(bestSet(plan, 4000)?.picks.map((p) => p.option.itemPower)).toEqual([900, 1000, 800])
  })

  it('keeps only sets that are stronger than every cheaper one', () => {
    for (let i = 1; i < plan.front.length; i++) {
      expect(plan.front[i].price).toBeGreaterThan(plan.front[i - 1].price)
      expect(plan.front[i].log).toBeGreaterThan(plan.front[i - 1].log)
    }
  })

  it('counts a two-handed weapon by its own damage scaling', () => {
    const set = bestSet(planSet(claymore, 'Martlock', pieces.slice(0, 3)), 3000)
    expect(set!.strength).toBeCloseTo(1.0918, 3)
    expect(set?.itemPower).toBe(Math.round((900 * 2 + 800 + 800) / 4))
  })

  it('gives the slider range', () => {
    expect(cheapestSet([plan])).toBe(2000)
    expect(dearestSet([plan])).toBe(25_500)
    expect(cheapestSet([planSet(sword, 'Lymhurst', [piece('MainHand')])])).toBeNull()
  })
})

describe('planSets', () => {
  const weapon: Weapon = { ...sword, variants: [[4, 0, 800], [5, 0, 900]] }
  const helmet = { base: 'HEAD_PLATE_SET1', name: 'Soldier Helmet', slot: 'Head' as const, variants: [[4, 0, 800], [5, 0, 900]] as [number, number, number][] }
  const date = new Date('2026-10-07T12:00:00Z')
  const price = (itemId: string, city: string, sellMin: number): Price =>
    ({ itemId, city, quality: 1, sellMin, sellMinDate: date, buyMax: null, buyMaxDate: null })
  const lookup = indexQualityPrices([
    // Martlock has the cheap weapon, Lymhurst the cheap helmet: no single city has both cheap.
    price('T4_MAIN_SWORD', 'Martlock', 1000),
    price('T5_MAIN_SWORD', 'Martlock', 2000),
    price('T4_HEAD_PLATE_SET1', 'Martlock', 5000),
    price('T4_MAIN_SWORD', 'Lymhurst', 4000),
    price('T4_HEAD_PLATE_SET1', 'Lymhurst', 500),
    price('T5_HEAD_PLATE_SET1', 'Lymhurst', 600),
  ])
  const settings = { cities: ['Martlock', 'Lymhurst'], maxAgeHours: 24, now: date.getTime() }

  it('buys every piece in the same city', () => {
    const plans = planSets(weapon, [[helmet]], lookup, settings)
    // Mixing cities would cost 1,000 + 500; within one city the cheapest set is Lymhurst at 4,500.
    expect(bestSetAnyCity(plans, 2000)).toBeNull()
    const set = bestSetAnyCity(plans, 5100)
    expect(set?.city).toBe('Lymhurst')
    expect(set?.picks.every((p) => p.option.city === 'Lymhurst')).toBe(true)
    expect(set?.price).toBe(4600)
    // With more silver, Martlock's T5 weapon set is stronger.
    expect(bestSetAnyCity(plans, 7000)).toMatchObject({ city: 'Martlock', price: 7000 })
  })

  it('prefers a city that sells the whole set over one missing a piece', () => {
    const plans = planSets(weapon, [[helmet]], lookup, settings)
    const onlyWeapon = planSets(weapon, [[{ ...helmet, base: 'HEAD_NONE' }]], lookup, settings)
    expect(bestSetAnyCity(onlyWeapon, 10_000)?.missing).toEqual(['Head'])
    expect(bestSetAnyCity(plans, 10_000)?.missing).toEqual([])
  })

  it('swaps in the next most common item when a city does not sell the usual one', () => {
    const usual = { ...helmet, base: 'HEAD_NONE' }
    const plans = planSets(weapon, [[usual, helmet]], lookup, settings)
    const set = bestSetAnyCity(plans, 10_000)
    expect(set?.missing).toEqual([])
    expect(set?.picks[1].piece).toMatchObject({ base: 'HEAD_PLATE_SET1', rank: 1 })
    // Where the usual item is sold, it is kept.
    const kept = planSets(weapon, [[helmet, usual]], lookup, settings)
    expect(bestSetAnyCity(kept, 10_000)?.picks[1].piece.rank).toBe(0)
  })

  it('buys at home and points to a notably stronger city', () => {
    const plans = planSets(weapon, [[helmet]], lookup, settings)
    // At 7,000 Martlock buys a T5 weapon set; Lymhurst only T4 weapon with T5 helmet.
    const fromLymhurst = homeAndBest(plans, 7000, 'Lymhurst')
    expect(fromLymhurst?.choice.city).toBe('Lymhurst')
    expect(fromLymhurst?.elsewhere?.city).toBe('Martlock')
    // From Martlock, Lymhurst is weaker, so no trip is suggested.
    expect(homeAndBest(plans, 7000, 'Martlock')).toMatchObject({ choice: { city: 'Martlock' }, elsewhere: null })
    // No home: the best city wins. Home can't afford anything: the best city that can.
    expect(homeAndBest(plans, 7000, null)?.choice.city).toBe('Martlock')
    expect(homeAndBest(plans, 4700, 'Martlock')).toMatchObject({ choice: { city: 'Lymhurst' }, elsewhere: null })
  })

  it('adds the mastery share of spec to higher-tier weapons', () => {
    const plans = planSets(weapon, [[helmet]], lookup, settings, 100)
    const set = bestSetAnyCity(plans, 7000)
    expect(set?.picks[0].option.itemPower).toBe(905)
  })
})
