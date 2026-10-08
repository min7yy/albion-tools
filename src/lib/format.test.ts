import { describe, expect, it } from 'vitest'
import { formatDay } from './format'

describe('formatDay', () => {
  it('writes a date as day and short month', () => {
    expect(formatDay('2026-09-29')).toBe('29 Sep')
    expect(formatDay('2026-10-08')).toBe('8 Oct')
    expect(formatDay('')).toBe('')
  })
})
