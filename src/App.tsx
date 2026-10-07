import { lazy, Suspense } from 'react'
import { SERVERS } from './api/servers'
import { useServer } from './useServer'
import { useHashRoute } from './useHashRoute'
import RefiningPage from './pages/RefiningPage'

// Crafting and flips carry ~6,500 recipes, so they load only when opened.
const CraftingPage = lazy(() => import('./pages/CraftingPage'))
const FlipsPage = lazy(() => import('./pages/FlipsPage'))

const PAGES = [
  { id: 'refining', label: 'Refining' },
  { id: 'crafting', label: 'Crafting' },
  { id: 'flips', label: 'Flips' },
] as const
type PageId = (typeof PAGES)[number]['id']

export default function App() {
  const [server, setServer] = useServer()
  const page = useHashRoute<PageId>(
    PAGES.map((p) => p.id),
    'refining',
  )

  return (
    <div className="app">
      <header>
        <div className="brand">
          <h1>Albion Tools</h1>
          <nav className="tabs" aria-label="Tools">
            {PAGES.map((p) => (
              <a key={p.id} href={`#/${p.id}`} className={page === p.id ? 'active' : ''} aria-current={page === p.id ? 'page' : undefined}>
                {p.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="server-switch" role="radiogroup" aria-label="Server">
          {SERVERS.map((s) => (
            <button
              key={s.id}
              role="radio"
              aria-checked={server === s.id}
              className={server === s.id ? 'active' : ''}
              onClick={() => setServer(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      {page === 'refining' ? (
        <RefiningPage server={server} />
      ) : (
        <Suspense fallback={<p className="hint">Loading…</p>}>
          {page === 'crafting' ? <CraftingPage server={server} /> : <FlipsPage server={server} />}
        </Suspense>
      )}
    </div>
  )
}
