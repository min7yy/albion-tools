import { RESOURCES } from '../api/items'
import { REFINING_SPECIALTY } from './settings'
import { resultKey } from './rank'
import type { RefiningResult } from './profit'
import type { SalesLookup } from '../api/history'
import { formatAge, formatPercent, formatPerDay, formatPerFocus, formatSilver, tierLabel } from '../lib/format'

interface Props {
  rows: RefiningResult[]
  selectedKey: string | null
  onSelect: (key: string) => void
  limit: number
  /** Undefined while sales history is loading or when it failed. */
  sales?: SalesLookup
  salesFailed?: boolean
}

export function RefiningTable({ rows, selectedKey, onSelect, limit, sales, salesFailed }: Props) {
  if (!rows.length) return <p className="hint">No rows match these filters.</p>
  return (
    <div className="table-wrap">
      <table className="ranked">
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>City</th>
            <th className="num">Cost</th>
            <th className="num">Sells for</th>
            <th className="num">Profit</th>
            <th className="num">Margin</th>
            <th className="num" title="Extra silver each focus point earns compared with refining without focus">
              Silver/focus
            </th>
            <th className="num" title="Average sold per day in this city over the last 7 days">
              Sold/day
            </th>
            <th className="num">Prices</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((r, i) => {
            const key = resultKey(r)
            const { tier, enchantment, resource } = r.recipe
            const specialty = REFINING_SPECIALTY[resource] === r.refineCity
            return (
              <tr
                key={key}
                className={key === selectedKey ? 'selected' : ''}
                onClick={() => onSelect(key)}
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(key)}
                aria-selected={key === selectedKey}
              >
                <td className="muted">{i + 1}</td>
                <td className="item">
                  <span className={`ench e${enchantment}`}>{tierLabel(tier, enchantment)}</span>{' '}
                  {RESOURCES[resource].refinedName}
                </td>
                <td>
                  {r.refineCity}
                  {specialty && (
                    <span className="badge" title="This city has the refining bonus for this resource">
                      bonus
                    </span>
                  )}
                </td>
                <td className="num">{formatSilver(r.totalCost)}</td>
                <td className="num">{formatSilver(r.netRevenue)}</td>
                <td className={`num strong ${r.profit === null ? '' : r.profit >= 0 ? 'pos' : 'neg'}`}>
                  {r.profit === null ? 'missing price' : formatSilver(r.profit)}
                </td>
                <td className="num">{formatPercent(r.margin)}</td>
                <td className="num">{formatPerFocus(r.silverPerFocus)}</td>
                <td className="num">{formatPerDay(salesFailed ? null : sales && (sales(r.recipe.output, r.refineCity)?.perDay ?? 0))}</td>
                <td className="num muted">{formatAge(r.oldestPriceDate)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length > limit && (
        <p className="hint">
          Showing the top {limit} of {rows.length}. Narrow the filters to see more.
        </p>
      )}
    </div>
  )
}
