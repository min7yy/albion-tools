import { useMemo } from 'react'
import type { ServerId } from '../api/servers'
import { indexPrices } from '../api/prices'
import { craftItemName } from '../crafting/data'
import { DEFAULT_FLIP_FILTERS, flipKey, flipsForItem, rankFlips } from '../flips/flips'
import { flipItemsFor } from '../flips/items'
import { flipMarketsFor } from '../flips/markets'
import type { TradeSettings } from '../profit'
import { FlipFiltersBar } from '../components/FlipFiltersBar'
import { TradeSettingsPanel } from '../components/TradeSettingsPanel'
import { ItemIcon } from '../components/ItemIcon'
import { usePrices } from '../usePrices'
import { useStoredState, withDefaults } from '../useStoredState'
import { formatAge, formatPercent, formatSilver } from '../format'
import { useLinkedFilters } from '../useLinkedFilters'
import { buildShareUrl, encodeFilters } from '../shareLink'
import { ShareButton } from '../components/ShareButton'

const ROW_LIMIT = 200
const DEFAULT_TRADE: TradeSettings = { premium: true, buyMode: 'instant', sellMode: 'instant' }

export default function FlipsPage({ server }: { server: ServerId }) {
  const [settings, setSettings] = useStoredState<TradeSettings>(
    'albion-tools.flips.settings',
    DEFAULT_TRADE,
    withDefaults(DEFAULT_TRADE),
  )
  const [filters, setFilters] = useLinkedFilters('flips', 'albion-tools.flips.filters', DEFAULT_FLIP_FILTERS)

  // Only fetch what the filters can show.
  const itemIds = useMemo(
    () =>
      flipItemsFor(filters.category, filters.sub)
        .filter((i) => filters.tier === 'all' || i.tier === filters.tier)
        .filter((i) => filters.enchantment === 'all' || i.ench === filters.enchantment)
        .map((i) => i.id),
    [filters.category, filters.sub, filters.tier, filters.enchantment],
  )
  const markets = useMemo(() => flipMarketsFor(filters.category), [filters.category])
  const { prices, loading, error, fetchedAt, reload } = usePrices(server, itemIds, markets)

  const rows = useMemo(() => {
    const index = indexPrices(prices)
    const lookup = (id: string, city: string) => index.get(`${id}|${city}`)
    const all = itemIds.flatMap((id) => flipsForItem(id, markets, lookup, settings))
    return rankFlips(all, filters)
  }, [itemIds, markets, prices, settings, filters])

  return (
    <div className="layout">
      <TradeSettingsPanel settings={settings} onChange={setSettings} />

      <main className="panel">
        <div className="toolbar">
          <FlipFiltersBar filters={filters} onChange={setFilters} />
          <div className="refresh">
            <span className="hint">
              {loading ? 'Loading prices…' : fetchedAt ? `Prices loaded ${formatAge(fetchedAt)}` : ''}
            </span>
            <ShareButton
              getUrl={() => {
                const params = encodeFilters(filters, DEFAULT_FLIP_FILTERS)
                params.set('server', server)
                return buildShareUrl(window.location.href, 'flips', params)
              }}
            />
            <button onClick={reload} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}

        {loading && !prices.length ? (
          <p className="hint">Loading prices for {itemIds.length} items…</p>
        ) : !rows.length ? (
          <p className="hint">No profitable flips match these filters. Try a lower margin or older prices.</p>
        ) : (
          <div className="table-wrap">
            <table className="ranked flips">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>Buy in</th>
                  <th className="num">Buy for</th>
                  <th>Sell in</th>
                  <th className="num">Sell for</th>
                  <th className="num">Fees</th>
                  <th className="num">Profit</th>
                  <th className="num">Margin</th>
                  <th className="num">Prices</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, ROW_LIMIT).map((f, i) => (
                  <tr key={flipKey(f)}>
                    <td className="muted">{i + 1}</td>
                    <td className="item">
                      <span className="item-cell">
                        <ItemIcon id={f.itemId} size={28} />
                        {craftItemName(f.itemId)}
                      </span>
                    </td>
                    <td>{f.buyMarket}</td>
                    <td className="num">{formatSilver(f.buyPrice)}</td>
                    <td>{f.sellMarket}</td>
                    <td className="num">{formatSilver(f.sellPrice)}</td>
                    <td className="num muted">{formatSilver(f.fees)}</td>
                    <td className="num strong pos">{formatSilver(f.profit)}</td>
                    <td className="num">{formatPercent(f.margin)}</td>
                    <td className="num muted">{formatAge(f.oldestPriceDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > ROW_LIMIT && (
              <p className="hint">
                Showing the top {ROW_LIMIT} of {rows.length}. Narrow the filters to see more.
              </p>
            )}
          </div>
        )}
        <p className="hint footer">
          Profit is per item after tax and setup fees. It doesn't include transport risk: routes into Caerleon and the
          Black Market cross red zones. Prices are for normal quality and only as fresh as the last scan of each market,
          so check in game before committing a big haul.
        </p>
      </main>
    </div>
  )
}
