import { RESOURCES } from '../api/items'
import { REFINING_SPECIALTY } from '../refining/settings'
import { resultKey } from '../refining/rank'
import type { RefiningResult } from '../refining/profit'
import { formatAge, formatPercent, formatSilver, tierLabel } from '../format'

interface Props {
  rows: RefiningResult[]
  selectedKey: string | null
  onSelect: (key: string) => void
  limit: number
}

export function RefiningTable({ rows, selectedKey, onSelect, limit }: Props) {
  if (!rows.length) return <p className="hint">No rows match these filters.</p>
  return (
    <div className="table-wrap">
      <table className="ranked">
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>City</th>
            <th>Cost</th>
            <th>Sells for</th>
            <th>Profit</th>
            <th>Margin</th>
            <th>Prices</th>
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
