import { useEffect, useState } from 'react'

/** The current page from the URL hash, e.g. "#/crafting" → "crafting". */
export function useHashRoute<T extends string>(routes: readonly T[], fallback: T): T {
  const read = () => {
    const name = window.location.hash.replace(/^#\/?/, '') as T
    return routes.includes(name) ? name : fallback
  }
  const [route, setRoute] = useState<T>(read)
  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  })
  return route
}
