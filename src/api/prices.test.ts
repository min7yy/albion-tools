import { describe, expect, it, vi } from 'vitest'
import { buildPriceUrls, fetchPrices, normalizePrice, type RawPrice } from './prices'
import { itemId } from './items'

const raw = (over: Partial<RawPrice> = {}): RawPrice => ({
  item_id: 'T4_METALBAR',
  city: 'Martlock',
  quality: 1,
  sell_price_min: 120,
  sell_price_min_date: '2026-10-06T12:00:00',
  sell_price_max: 150,
  sell_price_max_date: '2026-10-06T12:00:00',
  buy_price_min: 80,
  buy_price_min_date: '2026-10-06T12:00:00',
  buy_price_max: 100,
  buy_price_max_date: '2026-10-06T11:00:00',
  ...over,
})

describe('normalizePrice', () => {
  it('parses dates as UTC', () => {
    const p = normalizePrice(raw())
    expect(p.sellMin).toBe(120)
    expect(p.sellMinDate?.toISOString()).toBe('2026-10-06T12:00:00.000Z')
    expect(p.buyMax).toBe(100)
  })

  it('treats zero prices and placeholder dates as missing', () => {
    const p = normalizePrice(
      raw({ sell_price_min: 0, sell_price_min_date: '0001-01-01T00:00:00', buy_price_max: 0 }),
    )
    expect(p.sellMin).toBeNull()
    expect(p.sellMinDate).toBeNull()
    expect(p.buyMax).toBeNull()
    expect(p.buyMaxDate).toBeNull()
  })
})

describe('buildPriceUrls', () => {
  it('builds one URL for a short list', () => {
    const urls = buildPriceUrls('https://west.albion-online-data.com', ['T4_ORE', 'T4_METALBAR'], ['Martlock'])
    expect(urls).toEqual([
      'https://west.albion-online-data.com/api/v2/stats/prices/T4_ORE,T4_METALBAR.json?locations=Martlock&qualities=1',
    ])
  })

  it('splits long lists and keeps every item', () => {
    const items = Array.from({ length: 400 }, (_, i) => itemId(4 + (i % 5), 'METALBAR', i % 5))
    const urls = buildPriceUrls('https://europe.albion-online-data.com', items, ['Martlock', 'Fort Sterling'])
    expect(urls.length).toBeGreaterThan(1)
    for (const url of urls) expect(url.length).toBeLessThanOrEqual(4000)
    const back = urls.flatMap((u) =>
      decodeURIComponent(u.split('/prices/')[1].split('.json')[0]).split(','),
    )
    expect(back).toEqual(items)
  })
})

describe('fetchPrices', () => {
  it('hits the selected server and normalizes rows', async () => {
    const fetchImpl = vi.fn(async (_url: string) => new Response(JSON.stringify([raw()]), { status: 200 }))
    const prices = await fetchPrices({
      server: 'asia',
      items: ['T4_METALBAR'],
      locations: ['Martlock'],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(fetchImpl.mock.calls[0][0]).toMatch(/^https:\/\/east\.albion-online-data\.com\//)
    expect(prices[0].sellMin).toBe(120)
  })

  it('reports rate limiting clearly', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 429 }))
    await expect(
      fetchPrices({ server: 'europe', items: ['T4_ORE'], locations: ['Lymhurst'], fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/rate limit/)
  })
})
