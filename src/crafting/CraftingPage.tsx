import { useMemo, useState } from 'react'
import type { ServerId } from '../api/servers'
import { CRAFT_RECIPES, craftItemName } from './data'
import { BLACK_MARKET, type CraftingSettings } from './evaluate'
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
} from './rank'
import { DEFAULT_SETTINGS } from '../refining/settings'
import { SettingsPanel } from '../components/SettingsPanel'
import { CraftingFiltersBar } from './CraftingFiltersBar'
import { CraftingTable } from './CraftingTable'
import { ProfitBreakdown } from '../components/ProfitBreakdown'
import { usePrices } from '../hooks/usePrices'
import { useStoredState, withDefaults } from '../hooks/useStoredState'
import { formatAge } from '../lib/format'
import { useLinkedFilters } from '../hooks/useLinkedFilters'
import { buildShareUrl, encodeFilters } from '../lib/shareLink'
import { ShareButton } from '../components/ShareButton'
import { CRAFTING_CITIES, CRAFTING_MARKETS } from './cities'
import { HowItWorks, MoreOptions } from '../components/MoreOptions'
import { ageSummary, joinSummary, tradeSummary } from '../lib/optionsSummary'

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
  // Rows with missing prices can't be judged, so they're always hidden.
  const rows = useMemo(() => rankCrafting(results, { ...filters, hideIncomplete: true }), [results, filters])
  const selected = selectedKey ? rows.find((r) => craftingKey(r) === selectedKey) : undefined

  const qualityLabel = QUALITIES.find((q) => q.value === filters.quality)?.label ?? 'Normal'
  const rateNote =
    settings.returnRateOverride !== null ? ' (your override)' : settings.useFocus ? ' with focus' : ''

  return (
    <main className="panel">
      <div className="toolbar">
        <CraftingFiltersBar part="main" filters={filters} onChange={setFilters} />
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
      <MoreOptions
        summary={joinSummary([
          filters.city === 'all' ? 'Craft anywhere' : `Craft in ${filters.city}`,
          filters.sellAt === 'same' ? 'Sell in same city' : `Sell at ${filters.sellAt}`,
          `${qualityLabel} quality`,
          settings.useFocus ? 'Focus on' : 'No focus',
          ...tradeSummary(settings),
          ageSummary(filters.maxAgeHours),
        ])}
      >
        <CraftingFiltersBar part="more" filters={filters} onChange={setFilters} />
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onReset={() => setSettings(DEFAULT_SETTINGS)}
          showFocusCost={false}
        />
      </MoreOptions>
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
      <HowItWorks>
        Crafted items are priced at the sell quality you pick ({qualityLabel}); materials are always Normal. Return rates
        use the 18% city bonus plus the city's crafting specialty from the game data (rows marked "bonus", +15%).
        Selling to the Black Market is always an instant sell.
      </HowItWorks>
    </main>
  )
}
