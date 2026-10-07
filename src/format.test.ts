import { describe, expect, it } from 'vitest'
import { parseSilver } from './format'

describe('parseSilver', () => {
  it('reads plain amounts, separators and k/m shorthand', () => {
    expect(parseSilver('600,000')).toBe(600_000)
    expect(parseSilver('600.000')).toBe(600_000)
    expect(parseSilver('600k')).toBe(600_000)
    expect(parseSilver('1.2m')).toBe(1_200_000)
    expect(parseSilver('')).toBe(0)
    expect(parseSilver('abc')).toBeNull()
  })
})
