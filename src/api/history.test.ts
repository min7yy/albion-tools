import { describe, expect, it, vi } from 'vitest'
import { buildHistoryUrls, fetchSalesVolume, summarizeHistory, type RawHistory } from './history'

const NOW = new Date('2026-10-07T12:00:00Z').getTime()
const day = (daysAgo: number) => new Date(NOW - daysAgo * 86_400_000).toISOString().slice(0, 19)

const series = (over: Partial<RawHistory> = {}): RawHistory => ({
  location: 'Thetford',
  item_id: 'T4_METALBAR',
  quality: 1,
  data: [
    { item_count: 100, avg_price: 200, timestamp: day(1) },
    { item_count: 40, avg_price: 250, timestamp: day(3) },
    { item_count: 999, avg_price: 1, timestamp: day(10) }, // outside the 7-day window
  ],
  ...over,
})

describe('summarizeHistory', () => {
  it('averages sales per day over the window and weights the price by volume', () => {
    const v = summarizeHistory(series(), NOW)
    expect(v.perDay).toBeCloseTo(140 / 7)
    expect(v.avgPrice).toBeCloseTo((100 * 200 + 40 * 250) / 140)
  })

  it('reports no price when nothing sold', () => {
    expect(summarizeHistory(series({ data: [] }), NOW)).toEqual({ perDay: 0, avgPrice: null })
  })
})

describe('buildHistoryUrls', () => {
  it('asks for daily history of normal quality', () => {
    const [url] = buildHistoryUrls('https://x', ['T4_METALBAR'], ['Thetford', 'Lymhurst'])
    expect(url).toBe('https://x/api/v2/stats/history/T4_METALBAR.json?locations=Thetford%2CLymhurst&qualities=1&time-scale=24')
  })
})

describe('fetchSalesVolume', () => {
  it('keys volume by item and city and treats unseen pairs as zero sales', async () => {
    const fetchImpl = vi.fn(async (_url: string) => new Response(JSON.stringify([series()])))
    const volumes = await fetchSalesVolume({
      server: 'asia',
      items: ['T4_METALBAR'],
      locations: ['Thetford', 'Lymhurst'],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: NOW,
    })
    expect(fetchImpl.mock.calls[0][0]).toContain('east.albion-online-data.com/api/v2/stats/history/')
    expect(volumes.get('T4_METALBAR|Thetford')?.perDay).toBeCloseTo(20)
    expect(volumes.get('T4_METALBAR|Lymhurst')).toEqual({ perDay: 0, avgPrice: null })
  })

  it('reports API errors', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 500 }))
    await expect(
      fetchSalesVolume({ server: 'asia', items: ['T4_METALBAR'], locations: ['Thetford'], fetchImpl }),
    ).rejects.toThrow('Sales history error 500')
  })
})
