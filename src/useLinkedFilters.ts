import { useEffect, useState } from 'react'
import { useStoredState, withDefaults } from './useStoredState'
import { decodeFilters, markLinkUsed, openedParams } from './shareLink'

/**
 * Filters remembered between visits, except that a share link for this page
 * replaces them with the link's filters (anything the link leaves out is a default).
 * Also returns the row the link selected, if any.
 */
export function useLinkedFilters<T extends object>(page: string, storageKey: string, defaults: T) {
  const [params] = useState(() => openedParams(page))
  useEffect(() => markLinkUsed(page), [page])
  const linked = params && { ...defaults, ...decodeFilters(params, defaults) }
  const [filters, setFilters] = useStoredState<T>(
    storageKey,
    linked ?? defaults,
    linked ? () => linked : withDefaults(defaults),
  )
  return [filters, setFilters, params?.get('sel') ?? null] as const
}
