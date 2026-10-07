import { describe, expect, it } from 'vitest'
import { masteryModifier, slotWeight, specBonus, strength } from './power'

describe('slotWeight', () => {
  it('ranks weapon, then armour, then helmet and shoes, then cape', () => {
    const w = (slot: Parameters<typeof slotWeight>[0]) => slotWeight(slot, true)
    expect(w('MainHand')).toBeGreaterThan(w('Armor'))
    expect(w('Armor')).toBeGreaterThan(w('Head'))
    expect(w('Head')).toBe(w('Shoes'))
    expect(w('Shoes')).toBeGreaterThan(w('Cape'))
  })

  it('gives one-handed builds the same total weapon scaling as two-handed through the off-hand', () => {
    expect(slotWeight('MainHand', false) + slotWeight('OffHand', false)).toBeCloseTo(slotWeight('MainHand', true))
  })
})

describe('strength', () => {
  it('is 1 for a T4.0 set and multiplies per 100 item power', () => {
    expect(strength([{ slot: 'MainHand', itemPower: 800 }], true)).toBe(1)
    expect(strength([{ slot: 'MainHand', itemPower: 900 }], true)).toBeCloseTo(1.0918)
    expect(strength([{ slot: 'MainHand', itemPower: 1000 }], true)).toBeCloseTo(1.0918 ** 2)
  })
})

describe('spec', () => {
  it('adds 5% of spec per tier above T4', () => {
    expect(masteryModifier(4)).toBe(0)
    expect(masteryModifier(8)).toBeCloseTo(0.2)
    expect(specBonus(8, 100)).toBe(20)
    expect(specBonus(4, 100)).toBe(0)
  })
})
