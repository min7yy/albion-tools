import { lazy, type ComponentType } from 'react'

const RELOADED_KEY = 'albion-tools.reloaded-for-chunk'

/**
 * React.lazy for a page that survives deploys. Each deploy renames the page files, so a
 * tab opened before a deploy can't load a page it hasn't shown yet. When that happens we
 * reload once to pick up the new version; if it still fails the error boundary shows it.
 */
export function lazyPage<P>(load: () => Promise<{ default: ComponentType<P> }>) {
  return lazy(() =>
    load().then(
      (mod) => {
        try {
          sessionStorage.removeItem(RELOADED_KEY)
        } catch {
          // Storage unavailable; nothing to clear.
        }
        return mod
      },
      (error: unknown) => {
        let reloaded = true
        try {
          reloaded = sessionStorage.getItem(RELOADED_KEY) === '1'
          if (!reloaded) sessionStorage.setItem(RELOADED_KEY, '1')
        } catch {
          // Without storage we can't tell whether we already reloaded, so don't loop.
        }
        if (!reloaded) {
          window.location.reload()
          return new Promise<never>(() => {})
        }
        throw error
      },
    ),
  )
}
