import { useMemo, useState } from 'react'
import type { ServerId } from '../api/servers'
import { ROYAL_CITIES } from '../api/cities'
import { indexPrices } from '../api/prices'
import { allRecipes, allRefiningItemIds } from '../refining/recipes'
import { DEFAULT_SETTINGS, type RefiningSettings } from '../refining/settings'
import { DEFAULT_FILTERS, evaluateAll, rankResults, resultKey, type RefiningFilters } from '../refining/rank'
import { SettingsPanel } from '../components/SettingsPanel'
import { FiltersBar } from '../components/FiltersBar'
import { RefiningTable } from '../components/RefiningTable'
import { RefiningDetail } from '../components/RefiningDetail'
import { usePrices } from '../usePrices'
import { useSalesVolume } from '../useSalesVolume'
import { useStoredState, withDefaults } from '../useStoredState'
import { formatAge } from '../format'

const RECIPES = allRecipes()
const ITEM_IDS = allRefiningItemIds(RECIPES)
const OUTPUT_IDS = RECIPES.map((r) => r.output)
const CITIES = [...ROYAL_CITIES]
const ROW_LIMIT = 200

export default function RefiningPage({ server }: { server: ServerId }) {
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
  const volume = useSalesVolume(server, OUTPUT_IDS, CITIES)

  const results = useMemo(() => {
    const index = indexPrices(prices)
    return evaluateAll(RECIPES, CITIES, (id, city) => index.get(`${id}|${city}`), settings)
  }, [prices, settings])
  const rows = useMemo(
    () => rankResults(results, filters, fetchedAt?.getTime(), volume.sales),
    [results, filters, fetchedAt, volume.sales],
  )
  // Only show the breakdown while its row is still in the filtered list.
  const selected = selectedKey ? rows.find((r) => resultKey(r) === selectedKey) : undefined

  return (
    <>
      <div className="layout">
        <SettingsPanel settings={settings} onChange={setSettings} onReset={() => setSettings(DEFAULT_SETTINGS)} />

        <main className="panel">
          <div className="toolbar">
            <FiltersBar filters={filters} onChange={setFilters} />
            <div className="refresh">
              <span className="hint">
                {loading ? 'Loading prices…' : fetchedAt ? `Prices loaded ${formatAge(fetchedAt)}` : ''}
              </span>
              <button
                onClick={() => {
                  reload()
                  volume.reload()
                }}
                disabled={loading}
              >
                Refresh
              </button>
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          {volume.error && <p className="error">Sales per day unavailable: {volume.error}</p>}

          <div className={selected ? 'results with-detail' : 'results'}>
            {loading && !prices.length ? (
              <p className="hint">Loading prices for {ITEM_IDS.length} items…</p>
            ) : (
              <RefiningTable
                rows={rows}
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
                limit={ROW_LIMIT}
                sales={volume.sales}
                salesFailed={!!volume.error}
              />
            )}
            {selected && (
              <RefiningDetail
                result={selected}
                settings={settings}
                volume={
                  volume.error
                    ? null
                    : volume.sales && (volume.sales(selected.recipe.output, selected.refineCity) ?? { perDay: 0, avgPrice: null })
                }
                onClose={() => setSelectedKey(null)}
              />
            )}
          </div>
          <p className="hint footer">
            Each row buys materials, refines and sells in the same city. Prices come from the Albion Online Data
            Project and are only as fresh as the last player who scanned that market. Silver/focus is the extra profit
            each focus point adds compared with refining without focus.
          </p>
        </main>
      </div>
    </>
  )
}
