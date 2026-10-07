import { useMemo, useState } from 'react'
import { SERVERS } from './api/servers'
import { ROYAL_CITIES } from './api/cities'
import { indexPrices } from './api/prices'
import { allRecipes, allRefiningItemIds } from './refining/recipes'
import { DEFAULT_SETTINGS, type RefiningSettings } from './refining/settings'
import { DEFAULT_FILTERS, evaluateAll, rankResults, resultKey, type RefiningFilters } from './refining/rank'
import { SettingsPanel } from './components/SettingsPanel'
import { FiltersBar } from './components/FiltersBar'
import { RefiningTable } from './components/RefiningTable'
import { RefiningDetail } from './components/RefiningDetail'
import { useServer } from './useServer'
import { usePrices } from './usePrices'
import { useStoredState } from './useStoredState'
import { formatAge } from './format'

const RECIPES = allRecipes()
const ITEM_IDS = allRefiningItemIds(RECIPES)
const CITIES = [...ROYAL_CITIES]
const ROW_LIMIT = 200

function withDefaults<T extends object>(defaults: T) {
  return (saved: unknown): T =>
    saved && typeof saved === 'object' ? { ...defaults, ...(saved as Partial<T>) } : defaults
}

export default function App() {
  const [server, setServer] = useServer()
  const [settings, setSettings] = useStoredState<RefiningSettings>(
    'albion-tools.refining.settings',
    DEFAULT_SETTINGS,
    withDefaults(DEFAULT_SETTINGS),
  )
  const [filters, setFilters] = useStoredState<RefiningFilters>(
    'albion-tools.refining.filters',
    DEFAULT_FILTERS,
    withDefaults(DEFAULT_FILTERS),
  )
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const { prices, loading, error, fetchedAt, reload } = usePrices(server, ITEM_IDS, CITIES)

  const results = useMemo(() => {
    const index = indexPrices(prices)
    return evaluateAll(RECIPES, CITIES, (id, city) => index.get(`${id}|${city}`), settings)
  }, [prices, settings])
  const rows = useMemo(() => rankResults(results, filters), [results, filters])
  // Only show the breakdown while its row is still in the filtered list.
  const selected = selectedKey ? rows.find((r) => resultKey(r) === selectedKey) : undefined

  return (
    <div className="app">
      <header>
        <h1>
          Albion Tools <span className="subtitle">Refining profits</span>
        </h1>
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

      <div className="layout">
        <SettingsPanel settings={settings} onChange={setSettings} onReset={() => setSettings(DEFAULT_SETTINGS)} />

        <main className="panel">
          <div className="toolbar">
            <FiltersBar filters={filters} onChange={setFilters} />
            <div className="refresh">
              <span className="hint">
                {loading ? 'Loading prices…' : fetchedAt ? `Prices loaded ${formatAge(fetchedAt)}` : ''}
              </span>
              <button onClick={reload} disabled={loading}>
                Refresh
              </button>
            </div>
          </div>
          {error && <p className="error">{error}</p>}

          <div className={selected ? 'results with-detail' : 'results'}>
            {loading && !prices.length ? (
              <p className="hint">Loading prices for {ITEM_IDS.length} items…</p>
            ) : (
              <RefiningTable rows={rows} selectedKey={selectedKey} onSelect={setSelectedKey} limit={ROW_LIMIT} />
            )}
            {selected && (
              <RefiningDetail result={selected} settings={settings} onClose={() => setSelectedKey(null)} />
            )}
          </div>
          <p className="hint footer">
            Each row buys materials, refines and sells in the same city. Prices come from the Albion Online Data
            Project and are only as fresh as the last player who scanned that market.
          </p>
        </main>
      </div>
    </div>
  )
}
