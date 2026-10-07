/**
 * Share links: "#/refining?server=asia&tier=5&sel=…" opens a page with those filters.
 * Only filters, the server and the selected row travel in a link; personal settings
 * (premium, focus, fees) stay with each person.
 */

export interface LinkState {
  page: string
  params: URLSearchParams
}

export function parseHash(hash: string): LinkState {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  return { page: path, params: new URLSearchParams(query) }
}

/** The link this tab was opened with, captured before the app tidies the URL. */
export const OPENED_WITH: LinkState = parseHash(typeof window === 'undefined' ? '' : window.location.hash)

const used = new Set<string>()

/**
 * The query parameters the tab was opened with, if the link was for this page and the
 * page hasn't applied them yet (so going to another tab and back keeps your changes).
 */
export function openedParams(page: string): URLSearchParams | null {
  if (used.has(page) || OPENED_WITH.page !== page || ![...OPENED_WITH.params.keys()].length) return null
  return OPENED_WITH.params
}

/** Marks a page's link as applied. */
export function markLinkUsed(page: string): void {
  used.add(page)
}

function decodeValue(raw: string): unknown {
  if (raw === 'null') return null
  if (raw === 'true' || raw === 'false') return raw === 'true'
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw)
  return raw
}

/** Reads the filter fields present in `params`, keeping only values whose type fits the default. */
export function decodeFilters<T extends object>(params: URLSearchParams, defaults: T): Partial<T> {
  const out: Partial<T> = {}
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    const raw = params.get(key)
    if (raw === null) continue
    const value = decodeValue(raw)
    const fallback = defaults[key]
    // Booleans must stay booleans; other fields mix numbers, strings and null ("all", "any").
    if (typeof fallback === 'boolean' && typeof value !== 'boolean') continue
    if (typeof fallback !== 'boolean' && typeof value === 'boolean') continue
    out[key] = value as T[typeof key]
  }
  return out
}

/** Writes the filters that differ from their defaults, so links stay short. */
export function encodeFilters<T extends object>(filters: T, defaults: T, params = new URLSearchParams()): URLSearchParams {
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    if (filters[key] !== defaults[key]) params.set(key, String(filters[key]))
  }
  return params
}

/** The full link for a page view. */
export function buildShareUrl(base: string, page: string, params: URLSearchParams): string {
  const query = params.toString()
  return `${base.split('#')[0]}#/${page}${query ? `?${query}` : ''}`
}
