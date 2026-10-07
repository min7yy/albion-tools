import { useMemo, useState } from 'react'
import type { ServerId } from '../api/servers'
import { CRAFT_RECIPES, craftItemName } from '../crafting/data'
import { BLACK_MARKET, type CraftingSettings } from '../crafting/evaluate'
import {
  DEFAULT_CRAFTING_FILTERS,
  craftingItemIds,
  craftingKey,
  QUALITIES,
  evaluateAllCrafting,
  qualitiesFor,
  qualityLookup,
  rankCrafting,
  recipesFor,
} from '../crafting/rank'
import { DEFAULT_SETTINGS } from '../refining/settings'
import { SettingsPanel } from '../components/SettingsPanel'
import { CraftingFiltersBar } from '../components/CraftingFiltersBar'
import { CraftingTable } from '../components/CraftingTable'
import { ProfitBreakdown } from '../components/ProfitBreakdown'
import { usePrices } from '../usePrices'
import { useStoredState, withDefaults } from '../useStoredState'
import { formatAge } from '../format'
import { useLinkedFilters } from '../useLinkedFilters'
import { buildShareUrl, encodeFilters } from '../shareLink'
import { ShareButton } from '../components/ShareButton'
import { CRAFTING_CITIES, CRAFTING_MARKETS } from './craftingCities'

const ROW_LIMIT = 200
const nameOf = craftItemName

export default function CraftingPage({ server }: { server: ServerId }) {
  const [settings, setSettings] = useStoredState<CraftingSettings>(
    'albion-tools.crafting.settings',
    DEFAULT_SETTINGS,
    withDefaults(DEFAULT_SETTINGS),
  )
  const [filters, setFilters, linkedRow] = useLinkedFilters('crafting', 'albion-tools.crafting.filters', DEFAULT_CRAFTING_FILTERS)
  const [selectedKey, setSelectedKey] = useState<string | null>(linkedRow)

  const recipes = useMemo(() => recipesFor(CRAFT_RECIPES, filters), [filters])
  const itemIds = useMemo(() => craftingItemIds(recipes), [recipes])
  const qualities = useMemo(() => qualitiesFor(filters.quality), [filters.quality])
  const { prices, loading, error, fetchedAt, reload } = usePrices(server, itemIds, CRAFTING_MARKETS, qualities)

  const results = useMemo(() => {
    const lookup = qualityLookup(prices, new Set(recipes.map((r) => r.id)), filters.quality)
    return evaluateAllCrafting(recipes, CRAFTING_CITIES, filters.sellAt, lookup, settings)
  }, [recipes, prices, settings, filters.sellAt, filters.quality])
  const rows = useMemo(() => rankCrafting(results, filters), [results, filters])
  const selected = selectedKey ? rows.find((r) => craftingKey(r) === selectedKey) : undefined

  const qualityLabel = QUALITIES.find((q) => q.value === filters.quality)?.label ?? 'Normal'
  const rateNote =
    settings.returnRateOverride !== null ? ' (your override)' : settings.useFocus ? ' with focus' : ''

  return (
    <div className="layout">
      <SettingsPanel
        settings={settings}
        onChange={setSettings}
        onReset={() => setSettings(DEFAULT_SETTINGS)}
        showFocusCost={false}
      />

      <main className="panel">
        <div className="toolbar">
          <CraftingFiltersBar filters={filters} onChange={setFilters} />
          <div className="refresh">
            <span className="hint">
              {loading ? 'Loading prices…' : fetchedAt ? `Prices loaded ${formatAge(fetchedAt)}` : ''}
            </span>
            <ShareButton
              getUrl={() => {
                const params = encodeFilters(filters, DEFAULT_CRAFTING_FILTERS)
                params.set('server', server)
                if (selectedKey) params.set('sel', selectedKey)
                return buildShareUrl(window.location.href, 'crafting', params)
              }}
            />
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
              subtitle={`Buy materials and craft in ${selected.craftCity}. Return rate ${(selected.returnRate * 100).toFixed(1)}%${rateNote}. Focus cost ${selected.recipe.focus.toLocaleString()}. Sold at ${qualityLabel} quality.`}
              buyMode={settings.buyMode}
              sellMode={selected.sellCity === BLACK_MARKET ? 'instant' : settings.sellMode}
              nameOf={nameOf}
              onClose={() => setSelectedKey(null)}
            />
          )}
        </div>
        <p className="hint footer">
          Crafted items are priced at the sell quality you pick ({qualityLabel}); materials are always Normal. Return rates
          use the 18% city bonus plus the city's crafting specialty from the game data (rows marked "bonus", +15%).
          Selling to the Black Market is always an instant sell.
        </p>
      </main>
    </div>
  )
}
