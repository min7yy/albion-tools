import { useMemo, useState } from 'react'
import type { ServerId } from '../api/servers'
import { ROYAL_CITIES } from '../api/cities'
import { indexPrices } from '../api/prices'
import { allRecipes, allRefiningItemIds } from './recipes'
import { DEFAULT_SETTINGS, type RefiningSettings } from './settings'
import { DEFAULT_FILTERS, evaluateAll, rankResults, resultKey } from './rank'
import { SettingsPanel } from '../components/SettingsPanel'
import { RefiningFiltersBar } from './RefiningFiltersBar'
import { RefiningTable } from './RefiningTable'
import { RefiningDetail } from './RefiningDetail'
import { usePrices } from '../hooks/usePrices'
import { useSalesVolume } from '../hooks/useSalesVolume'
import { useStoredState, withDefaults } from '../hooks/useStoredState'
import { formatAge } from '../lib/format'
import { useLinkedFilters } from '../hooks/useLinkedFilters'
import { buildShareUrl, encodeFilters } from '../lib/shareLink'
import { ShareButton } from '../components/ShareButton'
import { HowItWorks, MoreOptions } from '../components/MoreOptions'
import { ageSummary, joinSummary, salesSummary, tradeSummary } from '../lib/optionsSummary'

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
  const [filters, setFilters, linkedRow] = useLinkedFilters('refining', 'albion-tools.refining.filters', DEFAULT_FILTERS)
  const [selectedKey, setSelectedKey] = useState<string | null>(linkedRow)
  const { prices, loading, error, fetchedAt, reload } = usePrices(server, ITEM_IDS, CITIES)
  const volume = useSalesVolume(server, OUTPUT_IDS, CITIES)

  const results = useMemo(() => {
    const index = indexPrices(prices)
    return evaluateAll(RECIPES, CITIES, (id, city) => index.get(`${id}|${city}`), settings)
  }, [prices, settings])
  // Rows with missing prices can't be judged, so they're always hidden.
  const rows = useMemo(
    () => rankResults(results, { ...filters, hideIncomplete: true }, fetchedAt?.getTime(), volume.sales),
    [results, filters, fetchedAt, volume.sales],
  )
  // Only show the breakdown while its row is still in the filtered list.
  const selected = selectedKey ? rows.find((r) => resultKey(r) === selectedKey) : undefined

  return (
    <main className="panel">
      <div className="toolbar">
        <RefiningFiltersBar part="main" filters={filters} onChange={setFilters} />
        <div className="refresh">
          <span className="hint">
            {loading ? 'Loading prices…' : fetchedAt ? `Prices loaded ${formatAge(fetchedAt)}` : ''}
          </span>
          <ShareButton
            getUrl={() => {
              const params = encodeFilters(filters, DEFAULT_FILTERS)
              params.set('server', server)
              if (selectedKey) params.set('sel', selectedKey)
              return buildShareUrl(window.location.href, 'refining', params)
            }}
          />
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
      <MoreOptions
        summary={joinSummary([
          settings.useFocus ? 'Focus on' : 'No focus',
          ...tradeSummary(settings),
          ageSummary(filters.maxAgeHours),
          salesSummary(filters.minDailySales),
        ])}
      >
        <RefiningFiltersBar part="more" filters={filters} onChange={setFilters} />
        <SettingsPanel settings={settings} onChange={setSettings} onReset={() => setSettings(DEFAULT_SETTINGS)} />
      </MoreOptions>
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
      <HowItWorks>
        Each row buys materials, refines and sells in the same city. Prices come from the Albion Online Data
        Project and are only as fresh as the last player who scanned that market. Silver/focus is the extra profit
        each focus point adds compared with refining without focus.
      </HowItWorks>
    </main>
  )
}
