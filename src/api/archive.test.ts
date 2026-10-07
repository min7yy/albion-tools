import { describe, expect, it } from 'vitest'
import { archiveLookup, mergeIntoArchive } from './archive'

const NOW = Date.parse('2026-10-07T12:00:00Z')
const row = (item_id: string, city: string, quality: number, sell_price_min: number, sell_price_min_date: string) => ({
  item_id,
  city,
  quality,
  sell_price_min,
  sell_price_min_date,
})

describe('price archive', () => {
  it('keeps the newest sell order per item, city and quality for a week', () => {
    const first = mergeIntoArchive(
      null,
      [
        row('T4_X', 'Martlock', 1, 500, '2026-10-06T10:00:00'),
        row('T4_X', 'Lymhurst', 1, 0, '0001-01-01T00:00:00'),
        row('T5_Y', 'Lymhurst', 2, 900, '2026-09-29T10:00:00'),
      ],
      NOW,
    )
    // The empty row is skipped and the 8-day-old one dropped.
    expect(Object.keys(first.items)).toEqual(['T4_X'])
    const second = mergeIntoArchive(
      first,
      [
        row('T4_X', 'Martlock', 1, 0, '0001-01-01T00:00:00'),
        row('T4_X', 'Lymhurst', 1, 450, '2026-10-07T11:00:00'),
      ],
      NOW,
    )
    const lookup = archiveLookup(second)
    expect(lookup('T4_X', 'Martlock', 1)).toEqual({ price: 500, date: new Date('2026-10-06T10:00:00Z') })
    expect(lookup('T4_X', 'Lymhurst', 1)).toEqual({ price: 450, date: new Date('2026-10-07T11:00:00Z') })
    expect(lookup('T4_X', 'Lymhurst', 2)).toBeUndefined()
    const third = mergeIntoArchive(second, [row('T4_X', 'Martlock', 1, 520, '2026-10-07T11:30:00')], NOW)
    expect(archiveLookup(third)('T4_X', 'Martlock', 1)?.price).toBe(520)
  })
})
