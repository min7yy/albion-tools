import { useMemo, useState } from 'react'
import type { ServerId } from '../api/servers'
import { indexPrices } from '../api/prices'
import { CRAFT_RECIPES, craftItemName } from '../crafting/data'
import { BLACK_MARKET, type CraftingSettings } from '../crafting/evaluate'
import {
  DEFAULT_CRAFTING_FILTERS,
  craftingItemIds,
  craftingKey,
  evaluateAllCrafting,
  rankCrafting,
  recipesFor,
  type CraftingFilters,
} from '../crafting/rank'
import { DEFAULT_SETTINGS } from '../refining/settings'
import { SettingsPanel } from '../components/SettingsPanel'
import { CraftingFiltersBar } from '../components/CraftingFiltersBar'
import { CraftingTable } from '../components/CraftingTable'
import { ProfitBreakdown } from '../components/ProfitBreakdown'
import { usePrices } from '../usePrices'
import { useStoredState, withDefaults } from '../useStoredState'
import { formatAge } from '../format'
import { CRAFTING_CITIES, CRAFTING_MARKETS } from './craftingCities'

const ROW_LIMIT = 200
const nameOf = craftItemName

export default function CraftingPage({ server }: { server: ServerId }) {
  const [settings, setSettings] = useStoredState<CraftingSettings>(
    'albion-tools.crafting.settings',
    DEFAULT_SETTINGS,
    withDefaults(DEFAULT_SETTINGS),
  )
  const [filters, setFilters] = useStoredState<CraftingFilters>(
    'albion-tools.crafting.filters',
    DEFAULT_CRAFTING_FILTERS,
    withDefaults(DEFAULT_CRAFTING_FILTERS),
  )
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const recipes = useMemo(() => recipesFor(CRAFT_RECIPES, filters), [filters])
  const itemIds = useMemo(() => craftingItemIds(recipes), [recipes])
  const { prices, loading, error, fetchedAt, reload } = usePrices(server, itemIds, CRAFTING_MARKETS)

  const results = useMemo(() => {
    const index = indexPrices(prices)
    return evaluateAllCrafting(recipes, CRAFTING_CITIES, filters.sellAt, (id, city) => index.get(`${id}|${city}`), settings)
  }, [recipes, prices, settings, filters.sellAt])
  const rows = useMemo(() => rankCrafting(results, filters), [results, filters])
  const selected = selectedKey ? rows.find((r) => craftingKey(r) === selectedKey) : undefined

  const rateNote =
    settings.returnRateOverride !== null ? ' (your override)' : settings.useFocus ? ' with focus' : ''

  return (
    <div className="layout">
      <SettingsPanel settings={settings} onChange={setSettings} onReset={() => setSettings(DEFAULT_SETTINGS)} />

      <main className="panel">
        <div className="toolbar">
          <CraftingFiltersBar filters={filters} onChange={setFilters} />
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
            <p className="hint">Loading prices for {itemIds.length} items…</p>
          ) : (
            <CraftingTable
              rows={rows}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              limit={ROW_LIMIT}
              showSellCity={filters.sellAt !== 'same'}
            />
          )}
          {selected && (
            <ProfitBreakdown
              result={selected}
              title={nameOf(selected.recipe.id)}
              subtitle={`Buy materials and craft in ${selected.craftCity}. Return rate ${(selected.returnRate * 100).toFixed(1)}%${rateNote}. Focus cost ${selected.recipe.focus.toLocaleString()}.`}
              buyMode={settings.buyMode}
              sellMode={selected.sellCity === BLACK_MARKET ? 'instant' : settings.sellMode}
              nameOf={nameOf}
              onClose={() => setSelectedKey(null)}
            />
          )}
        </div>
        <p className="hint footer">
          Prices are for normal quality. Crafted gear can come out at a higher quality and sell for more. Return rates
          use the 18% city bonus; city crafting specialties aren't included yet, so use the return rate override if
          you craft in a bonus city. Selling to the Black Market is always an instant sell.
        </p>
      </main>
    </div>
  )
}
