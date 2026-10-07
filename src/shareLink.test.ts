import { describe, expect, it } from 'vitest'
import { buildShareUrl, decodeFilters, encodeFilters, parseHash } from './shareLink'
import { DEFAULT_FILTERS, type RefiningFilters } from './refining/rank'

describe('share links', () => {
  const filters: RefiningFilters = { ...DEFAULT_FILTERS, resource: 'ore', tier: 5, maxAgeHours: null, hideIncomplete: false }

  it('only writes filters that differ from the defaults', () => {
    expect(encodeFilters(filters, DEFAULT_FILTERS).toString()).toBe(
      'resource=ore&tier=5&hideIncomplete=false&maxAgeHours=null',
    )
  })

  it('round-trips filters through a link', () => {
    const params = encodeFilters(filters, DEFAULT_FILTERS)
    params.set('server', 'asia')
    const url = buildShareUrl('https://min7yy.github.io/albion-tools/#/flips', 'refining', params)
    expect(url).toBe(
      'https://min7yy.github.io/albion-tools/#/refining?resource=ore&tier=5&hideIncomplete=false&maxAgeHours=null&server=asia',
    )
    const { page, params: read } = parseHash(new URL(url).hash)
    expect(page).toBe('refining')
    expect({ ...DEFAULT_FILTERS, ...decodeFilters(read, DEFAULT_FILTERS) }).toEqual(filters)
  })

  it('ignores unknown keys and values of the wrong type', () => {
    const decoded = decodeFilters(new URLSearchParams('hideIncomplete=5&tier=true&bogus=1&city=Martlock'), DEFAULT_FILTERS)
    expect(decoded).toEqual({ city: 'Martlock' })
  })
})
